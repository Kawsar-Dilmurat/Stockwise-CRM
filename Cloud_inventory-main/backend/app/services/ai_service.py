"""AI summary service — abstracted behind a clean interface.

The AI layer NEVER calculates numbers. It receives already-computed structured
insights and returns natural-language recommendations.

Swap the provider by setting AI_PROVIDER in env (mock | openai | anthropic | gemini).
Implement a new subclass of AIProvider and add it to `get_ai_provider()`.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import List

from app.schemas.insight import ProductInsight


class AIProvider(ABC):
    """Interface every AI provider must implement."""

    name: str = "base"

    @abstractmethod
    def restock_recommendation(self, insight: ProductInsight) -> str:
        """Return a short, plain-language restock recommendation for one product."""

    @abstractmethod
    def daily_low_stock_summary(self, insights: List[ProductInsight]) -> str:
        """Return a short daily summary across all low-stock items."""


class MockAIProvider(AIProvider):
    """Deterministic mock that mimics an inventory analyst's tone.

    Produces rich, specific recommendations that:
      - explain *why* an item is flagged (threshold vs depletion vs both vs stale),
      - state an urgency tier with a concrete timeline,
      - end with a clear, actionable next step.

    Uses only fields from the structured insight — no number calculation.
    """

    name = "mock"

    # ---------- internal helpers -------------------------------------------------
    def _urgency_tier(self, insight: ProductInsight) -> tuple[str, str, str]:
        """Return (label, timeline_phrase, action_verb).

        Label is read directly from the structured insight (computed by
        inventory_service) so the prose always matches the API field.
        """
        label = insight.urgency
        if label == "CRITICAL":
            if insight.stock_qty <= 0:
                return ("CRITICAL", "today — the item is out of stock", "Place an emergency purchase order")
            return ("CRITICAL", "within 24 hours", "Place an emergency purchase order")
        if label == "HIGH":
            return ("HIGH", "within 2–3 business days", "Submit a purchase order")
        if label == "MODERATE":
            return ("MODERATE", "within the next week", "Schedule a restock order")
        if label == "LOW":
            return ("LOW", "this is a soft signal — review at your next planning cycle", "Consider topping up")
        if label == "WATCH":
            return ("WATCH", "no rush, but review demand", "Consider holding off and reviewing")
        # HEALTHY shouldn't reach here in flagged path, but keep a safe default.
        return ("HEALTHY", "no action required", "Continue monitoring")

    def _flag_reason(self, insight: ProductInsight) -> str:
        days = insight.estimated_days_left
        below_threshold = insight.stock_qty <= insight.reorder_threshold
        depleting_fast = days is not None and days <= 5

        if insight.stock_qty <= 0:
            return (
                f"stock has hit zero while the SKU was averaging "
                f"{insight.avg_daily_sales:g} sales/day"
            )
        if below_threshold and depleting_fast:
            return (
                f"stock ({insight.stock_qty}) is at or below the reorder threshold of "
                f"{insight.reorder_threshold}, *and* current sell-through "
                f"(~{insight.avg_daily_sales:g}/day) only covers "
                f"~{days} more days"
            )
        if depleting_fast:
            return (
                f"sell-through has accelerated — "
                f"{insight.recent_7_day_sales} units sold in the last 7 days "
                f"(~{insight.avg_daily_sales:g}/day) will exhaust the remaining "
                f"{insight.stock_qty} units in roughly {days} days"
            )
        if below_threshold:
            return (
                f"stock ({insight.stock_qty}) has dropped to or below the reorder "
                f"threshold of {insight.reorder_threshold}, the safety floor "
                f"set for this SKU"
            )
        return (
            f"current inventory position is below the policy buffer for "
            f"{insight.category.lower()} items"
        )

    def _demand_descriptor(self, insight: ProductInsight) -> str:
        adps = insight.avg_daily_sales
        if adps == 0:
            return "no sales registered in the last 7 days — demand looks stale"
        if adps < 0.5:
            return f"slow movement (~{adps:g}/day on average)"
        if adps < 2:
            return f"steady demand (~{adps:g}/day)"
        if adps < 5:
            return f"strong demand (~{adps:g}/day)"
        return f"high-velocity demand (~{adps:g}/day)"

    # ---------- public API -------------------------------------------------------
    def restock_recommendation(self, insight: ProductInsight) -> str:
        # Healthy path
        if not insight.reorder_flag:
            demand = self._demand_descriptor(insight)
            buffer_msg = (
                f"comfortably above the {insight.reorder_threshold}-unit reorder threshold"
            )
            if insight.estimated_days_left is None:
                horizon = "no recent sales, so the runway is undefined"
            else:
                horizon = f"about {insight.estimated_days_left} days of cover at the current pace"
            return (
                f"{insight.name} (SKU {insight.sku}) — Status: HEALTHY. "
                f"You're holding {insight.stock_qty} units, {buffer_msg}, "
                f"with {demand} and {horizon}. "
                f"No action needed today; revisit on the next review cycle."
            )

        # Flagged path
        urgency, timeline, action = self._urgency_tier(insight)
        reason = self._flag_reason(insight)
        demand = self._demand_descriptor(insight)
        suggested = insight.suggested_reorder_qty

        # Stale-demand variant: avoid recommending huge orders when there's no recent sales
        if insight.avg_daily_sales == 0 and insight.stock_qty > 0:
            return (
                f"{insight.name} (SKU {insight.sku}) — Urgency: {urgency} ({timeline}). "
                f"Why flagged: {reason}. There were no sales in the last 7 days, "
                f"so the standard 14-day cover formula isn't reliable here. "
                f"Recommended action: hold off on a large reorder. Review whether this "
                f"SKU is seasonal, discontinued, or under-promoted before committing "
                f"to {suggested} more units."
            )

        return (
            f"{insight.name} (SKU {insight.sku}) — Urgency: {urgency} ({timeline}). "
            f"Why flagged: {reason}. Demand profile: {demand}, with "
            f"{insight.recent_7_day_sales} units sold in the last 7 days. "
            f"Recommended action: {action} for approximately {suggested} units to "
            f"restore ~14 days of safety cover. "
            f"This brings projected stock back in line with the reorder policy "
            f"({insight.reorder_threshold}-unit threshold) and protects against stockouts."
        )

    def daily_low_stock_summary(self, insights: List[ProductInsight]) -> str:
        if not insights:
            return (
                "All SKUs are at healthy levels today — no items have crossed their "
                "reorder thresholds and projected days-of-cover are within policy. "
                "No purchasing action is required. Continue monitoring for any "
                "demand spikes."
            )

        # Bucket by urgency
        critical, high, moderate, watch = [], [], [], []
        for i in insights:
            tier = self._urgency_tier(i)[0]
            (
                critical if tier == "CRITICAL"
                else high if tier == "HIGH"
                else watch if tier == "WATCH"
                else moderate
            ).append(i)

        # Sort each bucket by lowest days-left first
        def _key(i: ProductInsight):
            return i.estimated_days_left if i.estimated_days_left is not None else 9999
        for bucket in (critical, high, moderate, watch):
            bucket.sort(key=_key)

        total_units_needed = sum(i.suggested_reorder_qty for i in insights)
        lines: List[str] = []

        # Headline
        lines.append(
            f"{len(insights)} SKU(s) need attention today: "
            f"{len(critical)} critical, {len(high)} high, "
            f"{len(moderate)} moderate, {len(watch)} watch-list. "
            f"Combined suggested reorder quantity is ~{total_units_needed} units."
        )

        # Critical block — most actionable
        if critical:
            top = critical[:3]
            details = "; ".join(
                (
                    f"{i.name} ({'OUT OF STOCK' if i.stock_qty == 0 else f'{i.stock_qty} left'}"
                    f"{'' if i.estimated_days_left is None else f', ~{i.estimated_days_left}d'}"
                    f" → reorder ~{i.suggested_reorder_qty})"
                )
                for i in top
            )
            lines.append(
                f"Act today: {details}. "
                f"These items are at or near zero cover and risk immediate stockout."
            )

        # High block
        if high:
            top = high[:3]
            details = "; ".join(
                f"{i.name} (~{i.estimated_days_left}d left, reorder ~{i.suggested_reorder_qty})"
                for i in top
            )
            lines.append(f"Act this week: {details}.")

        # Moderate / watch — short mention
        if moderate:
            names = ", ".join(i.name for i in moderate[:3])
            extra = "" if len(moderate) <= 3 else f" (+{len(moderate) - 3} more)"
            lines.append(f"Plan ahead for: {names}{extra}.")

        if watch:
            names = ", ".join(i.name for i in watch[:2])
            lines.append(
                f"Watch list (slow-moving but flagged): {names} — "
                "review before committing to large reorders."
            )

        # Closing call to action
        lines.append(
            "Open the Insights page to drill into per-SKU recommendations and "
            "raise purchase orders directly from there."
        )

        return " ".join(lines)


# ---------------------------------------------------------------------------
# Future LLM providers — implement and register here. Example skeleton using
# the official OpenAI Python SDK (any provider that follows the chat/completions
# contract can be dropped in the same way):
#
# class OpenAIProvider(AIProvider):
#     name = "openai"
#     def __init__(self):
#         from openai import OpenAI                # pip install openai
#         self._client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
#         self._model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
#     def restock_recommendation(self, insight: ProductInsight) -> str:
#         prompt = f"Given this inventory snapshot, write a 2-sentence restock note: {insight.model_dump_json()}"
#         resp = self._client.chat.completions.create(
#             model=self._model,
#             messages=[{"role": "user", "content": prompt}],
#         )
#         return resp.choices[0].message.content.strip()
#     def daily_low_stock_summary(self, insights: List[ProductInsight]) -> str:
#         ...
# ---------------------------------------------------------------------------


def get_ai_provider() -> AIProvider:
    """Factory — returns the configured provider. Defaults to mock."""
    provider = os.environ.get("AI_PROVIDER", "mock").lower()
    if provider == "mock":
        return MockAIProvider()
    # Add real providers here when integrated.
    return MockAIProvider()
