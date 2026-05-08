"""Rule-based inventory insights.

All numeric calculations live here. The AI layer must NEVER calculate numbers —
it only converts these structured insights into natural language.
"""
import math
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Product, Sale
from app.schemas.insight import ProductInsight

WINDOW_DAYS = 7
TARGET_DAYS_OF_STOCK = 14
DAYS_LEFT_THRESHOLD = 5


def _round2(x: float) -> float:
    return round(x, 2)


def _compute_urgency(
    stock_qty: int,
    reorder_flag: bool,
    estimated_days_left: float | None,
) -> str:
    """Rule-based urgency tier — used by AI layer + frontend for color-coding.

    HEALTHY  → not flagged, plenty of cover
    WATCH    → flagged but no recent sales (slow-moving / stale demand)
    LOW      → flagged on threshold only, days-left still comfortable
    MODERATE → flagged with 5–10 days of cover
    HIGH     → flagged with 2–5 days of cover
    CRITICAL → out of stock, or <=2 days of cover
    """
    if not reorder_flag:
        return "HEALTHY"
    if stock_qty <= 0:
        return "CRITICAL"
    if estimated_days_left is None:
        return "WATCH"
    if estimated_days_left <= 2:
        return "CRITICAL"
    if estimated_days_left <= 5:
        return "HIGH"
    if estimated_days_left <= 10:
        return "MODERATE"
    return "LOW"


async def compute_product_insight(
    db: AsyncSession, product: Product
) -> ProductInsight:
    """Compute rule-based insight for a single product."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)

    result = await db.execute(
        select(func.coalesce(func.sum(Sale.quantity), 0)).where(
            Sale.product_id == product.id, Sale.sold_at >= cutoff
        )
    )
    recent_7_day_sales = int(result.scalar() or 0)

    avg_daily_sales = recent_7_day_sales / WINDOW_DAYS

    if avg_daily_sales <= 0:
        estimated_days_left = None
    else:
        estimated_days_left = _round2(product.stock_qty / avg_daily_sales)

    reorder_flag = product.stock_qty <= product.reorder_threshold or (
        estimated_days_left is not None and estimated_days_left <= DAYS_LEFT_THRESHOLD
    )

    target_qty = math.ceil(avg_daily_sales * TARGET_DAYS_OF_STOCK)
    suggested_reorder_qty = max(0, target_qty - product.stock_qty)
    if reorder_flag and suggested_reorder_qty == 0:
        # ensure we suggest at least the threshold worth when flagged but math says 0
        suggested_reorder_qty = max(product.reorder_threshold, 1)

    urgency = _compute_urgency(product.stock_qty, reorder_flag, estimated_days_left)

    return ProductInsight(
        product_id=product.id,
        name=product.name,
        sku=product.sku,
        category=product.category,
        stock_qty=product.stock_qty,
        reorder_threshold=product.reorder_threshold,
        recent_7_day_sales=recent_7_day_sales,
        avg_daily_sales=_round2(avg_daily_sales),
        estimated_days_left=estimated_days_left,
        reorder_flag=reorder_flag,
        suggested_reorder_qty=suggested_reorder_qty,
        urgency=urgency,
    )


async def compute_low_stock_insights(db: AsyncSession) -> List[ProductInsight]:
    """Return insights for all products that should be reordered."""
    result = await db.execute(select(Product).order_by(Product.name))
    products = result.scalars().all()
    insights = [await compute_product_insight(db, p) for p in products]
    return [i for i in insights if i.reorder_flag]


async def compute_all_insights(db: AsyncSession) -> List[ProductInsight]:
    result = await db.execute(select(Product).order_by(Product.name))
    products = result.scalars().all()
    return [await compute_product_insight(db, p) for p in products]
