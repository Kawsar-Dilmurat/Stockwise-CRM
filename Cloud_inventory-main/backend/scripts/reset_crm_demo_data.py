#!/usr/bin/env python3
"""
CRM demo data reset script — Stockwise-CRM CRM tables only.

WARNING: Deletes and re-creates demo data in activities, leads, and customers.
         Inventory tables (products, sales, restocks, suppliers) are UNTOUCHED.
         ONLY for use on Neon dev/child branches. Never run against production.

Dry-run (default, zero database changes):
    cd backend
    python scripts/reset_crm_demo_data.py

Execute (requires ALLOW_CRM_DEMO_RESET=true and a neon.tech DATABASE_URL):
    cd backend
    $env:ALLOW_CRM_DEMO_RESET="true"; python scripts/reset_crm_demo_data.py --execute

Expected KPIs after reset
--------------------------
Open pipeline (PROPOSAL + QUALIFIED + CONTACTED + NEW)   $11,900
  PROPOSAL   Devon Park   / Home Office Furniture Setup  $4,500  (70% → $3,150)
  QUALIFIED  Nadia Okonkwo/ Bedroom Furniture Bundle     $3,800  (50% → $1,900)
  CONTACTED  Sam Kowalski / Dining Room Set              $2,200  (25% →   $550)
  NEW        Priya Mendez / Washing Machine pkg          $1,400  (10% →   $140)
Weighted pipeline total                                  $5,740
Won this period (2 deals)                                $6,000
  Martha Chen   / Living Room Sofa Set                   $2,800
  Jordan Riley  / Kitchen Appliance Package              $3,200
Lost                                                     $  650  Devon Park / Gaming Chair
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make app.* imports resolve when the script is run from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from sqlalchemy import delete, func, select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models import Activity, Customer, Lead, Product  # noqa: E402
from app.models.lead import STAGE_PROBABILITY  # noqa: E402

# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

# (name, email, company, status)
DEMO_CUSTOMERS = [
    ("Martha Chen",   "martha@cheninteriors.com",  "Chen Interiors",   "CUSTOMER"),
    ("Jordan Riley",  "j.riley@rileyhomes.com",    "Riley Home Group", "CUSTOMER"),
    ("Devon Park",    "devon.park@gmail.com",       None,               "LEAD"),
    ("Nadia Okonkwo", "nadia@okonkworealty.com",   "Okonkwo Realty",   "LEAD"),
    ("Sam Kowalski",  "sam.kowalski@outlook.com",  None,               "LEAD"),
    ("Priya Mendez",  "priya.m@brightspace.co",    "Bright Space Co.", "LEAD"),
]

# (customer_name, title, stage, follow_up_days_offset,
#  product_name, quantity, discount, delivery_fee,
#  manual_value, extra_note)
#
# estimated_value = unit_price * quantity - discount + delivery_fee
# Set manual_value (int) to override the formula — notes will mark it "Manual Override: Yes".
# Product IDs are resolved at runtime by name so they survive a reset_demo_data.py re-run.
DEMO_LEADS = [
    # Martha Chen — WON: 2 fabric sofas + delivery
    # 1200 × 2 − 0 + 400 = 2 800
    (
        "Martha Chen", "Living Room Sofa Set", "WON", None,
        "3-Seat Fabric Sofa", 2, 0, 400, None, None,
    ),
    # Jordan Riley — WON: 2 refrigerators + delivery
    # 1400 × 2 − 0 + 400 = 3 200
    (
        "Jordan Riley", "Kitchen Appliance Package", "WON", None,
        "Stainless Refrigerator 22 cu ft", 2, 0, 400, None, None,
    ),
    # Devon Park — PROPOSAL: 10 office chairs + delivery
    # 420 × 10 − 0 + 300 = 4 500
    (
        "Devon Park", "Home Office Furniture Setup", "PROPOSAL", 3,
        "Ergonomic Office Chair", 10, 0, 300, None, None,
    ),
    # Nadia Okonkwo — QUALIFIED: 4 walnut bed frames, loyalty discount, delivery
    # 950 × 4 − 100 + 100 = 3 800
    (
        "Nadia Okonkwo", "Bedroom Furniture Bundle", "QUALIFIED", 5,
        "Queen Bed Frame - Walnut", 4, 100, 100, None, None,
    ),
    # Sam Kowalski — CONTACTED: 1 dining table + delivery
    # 1800 × 1 − 0 + 400 = 2 200
    (
        "Sam Kowalski", "Dining Room Set", "CONTACTED", 7,
        "Oak Dining Table 6-Seater", 1, 0, 400, None, None,
    ),
    # Priya Mendez — NEW: washing machine; delivery fee covers installation package
    # 780 × 1 − 0 + 620 = 1 400
    (
        "Priya Mendez", "Washing Machine + Vacuum Cleaner", "NEW", 4,
        "Front-Load Washing Machine 7kg", 1, 0, 620, None,
        "Single-product quote; delivery fee includes installation package.",
    ),
    # Devon Park — LOST: customer wanted gaming-specific model; no exact stock match
    # manual_value = 650 (custom build quote; formula not used)
    (
        "Devon Park", "Ergonomic Gaming Chair", "LOST", None,
        "Ergonomic Office Chair", 1, 0, 0, 650,
        "Customer wanted gaming-specific model; no exact stock match — quoted as custom build.",
    ),
]

# (customer_name, lead_title, activity_type, communication_method,
#  completed, due_days_offset, note)
# due_days_offset=None means no due_date.
DEMO_ACTIVITIES = [
    (
        "Martha Chen", "Living Room Sofa Set",
        "INTERACTION", "EMAIL", True, None,
        "Confirmed order; delivery scheduled for next Tuesday",
    ),
    (
        "Jordan Riley", "Kitchen Appliance Package",
        "INTERACTION", "CALL", True, None,
        "Final pricing agreed; invoice #INV-2041 sent",
    ),
    (
        "Devon Park", "Home Office Furniture Setup",
        "FOLLOW_UP", None, False, 3,
        "Send revised proposal with 12-month financing breakdown",
    ),
    (
        "Devon Park", "Home Office Furniture Setup",
        "NOTE", None, True, None,
        "Prefers minimalist style; interested in financing option",
    ),
    (
        "Nadia Okonkwo", "Bedroom Furniture Bundle",
        "INTERACTION", "MEETING", True, None,
        "Showroom visit — liked walnut bed frame and white bookcase",
    ),
    (
        "Nadia Okonkwo", "Bedroom Furniture Bundle",
        "FOLLOW_UP", None, False, 5,
        "Follow up on bedroom quote; ask about mattress add-on",
    ),
    (
        "Sam Kowalski", "Dining Room Set",
        "FOLLOW_UP", None, False, 7,
        "Call to walk through dining table and chair options",
    ),
    (
        "Priya Mendez", "Washing Machine + Vacuum Cleaner",
        "INTERACTION", "EMAIL", True, None,
        "Sent product catalog and current pricing sheet",
    ),
    (
        "Priya Mendez", "Washing Machine + Vacuum Cleaner",
        "FOLLOW_UP", None, False, 4,
        "Check if catalog was reviewed; offer free delivery promo",
    ),
]

# ---------------------------------------------------------------------------
# Safety guards
# ---------------------------------------------------------------------------

def _die(msg):
    print(f"\n[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def _check_safety():
    db_url = os.environ.get("DATABASE_URL", "")
    allow  = os.environ.get("ALLOW_CRM_DEMO_RESET", "")

    if not db_url:
        _die("DATABASE_URL is not set.")

    if "neon.tech" not in db_url:
        _die(
            "DATABASE_URL does not contain 'neon.tech'.\n"
            "  --execute is only permitted on Neon dev/child branches.\n"
            "  This script must NOT be run against a local or production database."
        )

    if "prod" in db_url.lower() or "production" in db_url.lower():
        _die(
            "DATABASE_URL appears to reference a production database.\n"
            "  Refusing to reset CRM demo data."
        )

    if allow.strip().lower() != "true":
        _die(
            "ALLOW_CRM_DEMO_RESET is not set to 'true'.\n"
            "  Set ALLOW_CRM_DEMO_RESET=true to confirm you intend to reset CRM demo data."
        )

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lead_key(customer_map, lead):
    """Return (customer_name, lead_title) for a flushed Lead object."""
    for name, cust in customer_map.items():
        if cust.id == lead.customer_id:
            return (name, lead.title)
    return ("", lead.title)


def _build_quote_notes(
    product_name, sku, quantity, unit_price,
    discount, delivery_fee, estimated_value, manual_override, extra_note=None,
):
    """Return a pipe-delimited quote summary for the lead notes field (≤1000 chars)."""
    subtotal = unit_price * quantity
    parts = [
        f"Product: {product_name}",
        f"SKU: {sku}",
        f"Quantity: {quantity}",
        f"Unit Price: ${unit_price:,}",
        f"Subtotal: ${subtotal:,}",
        f"Discount: ${discount:,}",
        f"Delivery Fee: ${delivery_fee:,}",
        f"Estimated Value: ${estimated_value:,}",
        f"Manual Override: {'Yes' if manual_override else 'No'}",
    ]
    if extra_note:
        parts.append(extra_note)
    return " | ".join(parts)[:1000]


async def _fetch_product_map(db):
    """Return {product_name: (id, unit_price, sku)} from the products table."""
    rows = (
        await db.execute(select(Product.id, Product.name, Product.sku, Product.unit_price))
    ).all()
    return {row.name: (row.id, row.unit_price or 0, row.sku) for row in rows}


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

async def _fetch_counts(db):
    return {
        "activities": (await db.execute(select(func.count(Activity.id)))).scalar() or 0,
        "leads":      (await db.execute(select(func.count(Lead.id)))).scalar()     or 0,
        "customers":  (await db.execute(select(func.count(Customer.id)))).scalar() or 0,
    }


async def run(execute):
    print("\n=== Stockwise-CRM Demo Data Reset (CRM tables) ===")
    print("WARNING: This resets CRM tables only. Inventory tables are not touched.")
    print("WARNING: Only use this on the Neon child/dev branch — never on production.")
    print(f"Mode    : {'EXECUTE' if execute else 'DRY-RUN  (no database changes)'}\n")

    if execute:
        _check_safety()
        print("[SAFETY] neon.tech branch confirmed in DATABASE_URL.")
        print("[SAFETY] ALLOW_CRM_DEMO_RESET=true confirmed.\n")

    async with AsyncSessionLocal() as db:
        counts = await _fetch_counts(db)

        print("Current row counts:")
        for table, n in counts.items():
            print(f"  {table:<12} {n:>6}")

        print("\nPlanned deletes (in order):")
        print(f"  DELETE FROM activities — {counts['activities']} rows")
        print(f"  DELETE FROM leads      — {counts['leads']} rows")
        print(f"  DELETE FROM customers  — {counts['customers']} rows")

        print("\nPlanned inserts:")
        print(f"  {len(DEMO_CUSTOMERS)} customers")
        print(f"  {len(DEMO_LEADS)} leads/opportunities")
        print(f"  {len(DEMO_ACTIVITIES)} activities/follow-up tasks")

        print("\nExpected KPIs after reset:")
        print("  Open pipeline (PROPOSAL/QUALIFIED/CONTACTED/NEW):  $11,900")
        print("    PROPOSAL   Home Office Furniture Setup   $4,500  (weighted $3,150)")
        print("    QUALIFIED  Bedroom Furniture Bundle      $3,800  (weighted $1,900)")
        print("    CONTACTED  Dining Room Set               $2,200  (weighted $  550)")
        print("    NEW        Washing Machine pkg           $1,400  (weighted $  140)")
        print("  Weighted pipeline total:                            $5,740")
        print("  Won this period (2 deals):                          $6,000")
        print("    Martha Chen  — Living Room Sofa Set      $2,800")
        print("    Jordan Riley — Kitchen Appliance Package $3,200")
        print("  Lost:                                               $  650")

        if not execute:
            print("\n[DRY-RUN] No changes made.")
            print(
                "          Rerun with --execute "
                "(and ALLOW_CRM_DEMO_RESET=true) to apply.\n"
            )
            return

        now = datetime.now(timezone.utc)

        try:
            # Delete in FK-safe order (children before parents).
            await db.execute(delete(Activity))
            await db.execute(delete(Lead))
            await db.execute(delete(Customer))
            print("\n[EXECUTE] Existing CRM rows deleted.")

            # Resolve product IDs by name — inventory tables are not touched.
            product_map = await _fetch_product_map(db)
            if not product_map:
                print("[WARN] No products found in database. Lead product_id fields will be NULL.")

            # Customers.
            customer_objs = [
                Customer(name=name, email=email, company=company, status=status)
                for name, email, company, status in DEMO_CUSTOMERS
            ]
            db.add_all(customer_objs)
            await db.flush()
            customer_map_obj = {c.name: c for c in customer_objs}

            # Leads — estimated_value computed from quote formula unless manual_value is set.
            lead_objs = []
            for (
                cust_name, title, stage, fu_offset,
                product_name, quantity, discount, delivery_fee,
                manual_value, extra_note,
            ) in DEMO_LEADS:
                prod_entry = product_map.get(product_name)
                if prod_entry:
                    prod_id, unit_price, sku = prod_entry
                else:
                    prod_id, unit_price, sku = None, 0, "UNKNOWN"
                    print(f"[WARN] Product not found: '{product_name}' — '{title}' will have no product_id.")

                is_manual = manual_value is not None
                estimated_value = manual_value if is_manual else (unit_price * quantity - discount + delivery_fee)

                notes = _build_quote_notes(
                    product_name, sku, quantity, unit_price,
                    discount, delivery_fee, estimated_value, is_manual, extra_note,
                )

                lead = Lead(
                    customer_id=customer_map_obj[cust_name].id,
                    title=title,
                    stage=stage,
                    estimated_value=estimated_value,
                    close_probability=STAGE_PROBABILITY[stage],
                    owner="Alex",
                    next_follow_up_date=(
                        now + timedelta(days=fu_offset) if fu_offset is not None else None
                    ),
                    product_id=prod_id,
                    quantity=quantity,
                    discount=discount,
                    delivery_fee=delivery_fee,
                    notes=notes,
                )
                lead_objs.append(lead)
            db.add_all(lead_objs)
            await db.flush()

            # Build a (customer_name, lead_title) → lead lookup.
            lead_map = {_lead_key(customer_map_obj, l): l for l in lead_objs}

            # Activities.
            activity_objs = []
            for cust_name, lead_title, act_type, comm_method, completed, due_offset, note in DEMO_ACTIVITIES:
                key = (cust_name, lead_title)
                lead_obj = lead_map.get(key)
                activity = Activity(
                    customer_id=customer_map_obj[cust_name].id,
                    lead_id=lead_obj.id if lead_obj else None,
                    activity_type=act_type,
                    communication_method=comm_method,
                    note=note,
                    due_date=(now + timedelta(days=due_offset) if due_offset is not None else None),
                    completed=completed,
                    completed_at=(now - timedelta(days=1) if completed else None),
                )
                activity_objs.append(activity)
            db.add_all(activity_objs)

            await db.commit()
            print(
                f"[EXECUTE] Inserted: {len(customer_objs)} customers, "
                f"{len(lead_objs)} leads, "
                f"{len(activity_objs)} activities."
            )

        except Exception as exc:
            await db.rollback()
            _die(f"Transaction failed and was rolled back.\n  Detail: {exc}")

        final = await _fetch_counts(db)
        print("\nFinal row counts:")
        for table, n in final.items():
            print(f"  {table:<12} {n:>6}")

    print("\n[DONE] CRM demo data reset complete.\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Reset Stockwise-CRM CRM demo data (activities, leads, customers). "
            "Inventory tables are not touched. "
            "Only for use on Neon dev/child branches."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Apply changes to the database. Default is dry-run.",
    )
    args = parser.parse_args()
    asyncio.run(run(execute=args.execute))


if __name__ == "__main__":
    main()
