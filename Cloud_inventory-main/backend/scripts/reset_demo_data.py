#!/usr/bin/env python3
"""
Demo data reset script — Stockwise-CRM inventory tables only.

WARNING: Deletes and re-creates demo data in sales, restocks, products, and
         suppliers. CRM tables (customers, leads, activities) are untouched.
         ONLY for use on Neon dev/child branches. Never run against production.

Dry-run (default, zero database changes):
    cd backend
    python scripts/reset_demo_data.py

Execute (requires ALLOW_DEMO_RESET=true):
    cd backend
    ALLOW_DEMO_RESET=true python scripts/reset_demo_data.py --execute
"""
import argparse
import asyncio
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make app.* imports resolve when the script is run from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402 (must follow sys.path patch)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from sqlalchemy import delete, func, select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models import Product, Restock, Sale, Supplier  # noqa: E402

# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

DEMO_SUPPLIERS = [
    {"name": "HomeBase Distributors",    "contact": "orders@homebase-dist.com"},
    {"name": "Apex Furniture Wholesale", "contact": "+1 555-0201"},
    {"name": "Pacific Appliance Supply", "contact": "sales@pacappliance.com"},
    {"name": "Nordic Living Co.",        "contact": "info@nordicliving.com"},
]

# stock_qty here is the desired *current* inventory level.
# Sales and restock records are inserted as historical data only —
# they do NOT adjust stock_qty. The value on the product row IS the live stock.
DEMO_PRODUCTS = [
    {"name": "3-Seat Fabric Sofa",              "sku": "SOFA-FAB-001", "category": "Furniture",  "stock_qty":  4, "reorder_threshold": 3,  "unit_price": 1200},
    {"name": "Oak Dining Table 6-Seater",       "sku": "TABL-OAK-006", "category": "Furniture",  "stock_qty":  2, "reorder_threshold": 2,  "unit_price": 1800},
    {"name": "Queen Bed Frame - Walnut",         "sku": "BED-WAL-Q",    "category": "Furniture",  "stock_qty":  3, "reorder_threshold": 2,  "unit_price":  950},
    {"name": "Bookcase 5-Shelf White",          "sku": "BOOK-5S-WHT",  "category": "Furniture",  "stock_qty":  7, "reorder_threshold": 4,  "unit_price":  380},
    {"name": "Ergonomic Office Chair",          "sku": "CHAIR-ERG-01", "category": "Furniture",  "stock_qty":  6, "reorder_threshold": 5,  "unit_price":  420},
    {"name": "Stainless Refrigerator 22 cu ft", "sku": "FRID-SS-22",   "category": "Appliances", "stock_qty":  2, "reorder_threshold": 2,  "unit_price": 1400},
    {"name": "Front-Load Washing Machine 7kg",  "sku": "WASH-FL-7KG",  "category": "Appliances", "stock_qty":  3, "reorder_threshold": 2,  "unit_price":  780},
    {"name": "4-Burner Gas Range",              "sku": "RANG-GAS-4B",  "category": "Appliances", "stock_qty":  2, "reorder_threshold": 2,  "unit_price":  650},
    {"name": "Upright Vacuum Cleaner",          "sku": "VAC-UPRT-01",  "category": "Appliances", "stock_qty":  9, "reorder_threshold": 5,  "unit_price":  220},
    {"name": "Tower Fan 42-inch",               "sku": "FAN-TWR-42",   "category": "Appliances", "stock_qty": 12, "reorder_threshold": 6,  "unit_price":  160},
]

# (product_sku, supplier_name, qty, note, days_ago)
DEMO_RESTOCKS = [
    ("SOFA-FAB-001", "Apex Furniture Wholesale", 5,  "Initial delivery · PO-4821",       40),
    ("TABL-OAK-006", "Apex Furniture Wholesale", 4,  "Seasonal replenishment · PO-4835", 35),
    ("FRID-SS-22",   "Pacific Appliance Supply",  6,  "PO-5012",                          30),
    ("WASH-FL-7KG",  "Pacific Appliance Supply",  5,  "PO-5019",                          25),
    ("BED-WAL-Q",    "Nordic Living Co.",          4,  "Showroom stock · PO-3301",         20),
    ("CHAIR-ERG-01", "HomeBase Distributors",      8,  "Bulk order · PO-2201",             14),
    ("FAN-TWR-42",   "HomeBase Distributors",      15, "Pre-summer order · PO-2218",        7),
    ("RANG-GAS-4B",  "Pacific Appliance Supply",   3,  "Special order · PO-5031",           3),
]


def _build_sales(products: list, now: datetime) -> list:
    """
    Generate repeatable 30-day sales history with seed=42.
    Does not touch product.stock_qty — history records only.
    """
    rng = random.Random(42)
    daily_weight = {"Furniture": 0.4, "Appliances": 0.7}
    sales = []
    for product in products:
        weight = daily_weight.get(product.category, 0.5)
        for day in range(30):
            daily_count = max(0, round(rng.gauss(weight, 0.5)))
            for _ in range(daily_count):
                sold_at = now - timedelta(
                    days=day,
                    hours=rng.randint(0, 23),
                    minutes=rng.randint(0, 59),
                )
                sales.append(
                    Sale(
                        product_id=product.id,
                        quantity=rng.randint(1, 2),
                        sold_at=sold_at,
                    )
                )
    return sales


# ---------------------------------------------------------------------------
# Safety guards
# ---------------------------------------------------------------------------

def _die(msg: str) -> None:
    print(f"\n[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def _check_safety() -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    allow  = os.environ.get("ALLOW_DEMO_RESET", "")

    if not db_url:
        _die("DATABASE_URL is not set.")

    if "neon.tech" not in db_url:
        _die(
            "DATABASE_URL does not contain 'neon.tech'.\n"
            "  --execute is only permitted on Neon dev/child branches."
        )

    if "prod" in db_url.lower() or "production" in db_url.lower():
        _die(
            "DATABASE_URL appears to reference a production database.\n"
            "  Refusing to reset data."
        )

    if allow.strip().lower() != "true":
        _die(
            "ALLOW_DEMO_RESET is not set to 'true'.\n"
            "  Set ALLOW_DEMO_RESET=true to confirm you intend to reset demo data."
        )


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

async def _fetch_counts(db) -> dict:
    return {
        "sales":     (await db.execute(select(func.count(Sale.id)))).scalar()     or 0,
        "restocks":  (await db.execute(select(func.count(Restock.id)))).scalar()  or 0,
        "products":  (await db.execute(select(func.count(Product.id)))).scalar()  or 0,
        "suppliers": (await db.execute(select(func.count(Supplier.id)))).scalar() or 0,
    }


async def run(execute: bool) -> None:
    print("\n=== Stockwise-CRM Demo Data Reset ===")
    print("WARNING: This resets inventory tables only. CRM tables are not touched.")
    print(f"Mode    : {'EXECUTE' if execute else 'DRY-RUN  (no database changes)'}\n")

    if execute:
        _check_safety()
        print("[SAFETY] neon.tech branch confirmed in DATABASE_URL.")
        print("[SAFETY] ALLOW_DEMO_RESET=true confirmed.\n")

    async with AsyncSessionLocal() as db:
        counts = await _fetch_counts(db)

        print("Current row counts:")
        for table, n in counts.items():
            print(f"  {table:<12} {n:>6}")

        print("\nPlanned deletes (in order):")
        print(f"  DELETE FROM sales      — {counts['sales']} rows")
        print(f"  DELETE FROM restocks   — {counts['restocks']} rows")
        print(f"  DELETE FROM products   — {counts['products']} rows")
        print(f"  DELETE FROM suppliers  — {counts['suppliers']} rows")

        print("\nPlanned inserts:")
        print(f"  {len(DEMO_SUPPLIERS)} suppliers")
        print(f"  {len(DEMO_PRODUCTS)} products")
        print(f"  {len(DEMO_RESTOCKS)} restock records (8 events across 4 suppliers)")
        print(f"  Sales history — 30 days, random seed=42, low-volume home goods pace")

        if not execute:
            print("\n[DRY-RUN] No changes made.")
            print("          Rerun with --execute (and ALLOW_DEMO_RESET=true) to apply.\n")
            return

        now = datetime.now(timezone.utc)

        try:
            # Delete in FK-safe order (children before parents).
            await db.execute(delete(Sale))
            await db.execute(delete(Restock))
            await db.execute(delete(Product))
            await db.execute(delete(Supplier))
            print("\n[EXECUTE] Existing rows deleted.")

            # Suppliers.
            supplier_objs = [Supplier(**s) for s in DEMO_SUPPLIERS]
            db.add_all(supplier_objs)
            await db.flush()
            supplier_map = {s.name: s for s in supplier_objs}

            # Products — stock_qty is set to final desired value directly.
            product_objs = [Product(**p) for p in DEMO_PRODUCTS]
            db.add_all(product_objs)
            await db.flush()
            product_map = {p.sku: p for p in product_objs}

            # Restock history.
            for sku, supplier_name, qty, note, days_ago in DEMO_RESTOCKS:
                db.add(
                    Restock(
                        product_id=product_map[sku].id,
                        supplier_id=supplier_map[supplier_name].id,
                        quantity=qty,
                        note=note,
                        restocked_at=now - timedelta(days=days_ago),
                    )
                )

            # Sales history — historical records, do not adjust product.stock_qty.
            sales = _build_sales(product_objs, now)
            db.add_all(sales)

            await db.commit()
            print(
                f"[EXECUTE] Inserted: {len(DEMO_SUPPLIERS)} suppliers, "
                f"{len(DEMO_PRODUCTS)} products, "
                f"{len(DEMO_RESTOCKS)} restocks, "
                f"{len(sales)} sales."
            )

        except Exception as exc:
            await db.rollback()
            _die(f"Transaction failed and was rolled back.\n  Detail: {exc}")

        final = await _fetch_counts(db)
        print("\nFinal row counts:")
        for table, n in final.items():
            print(f"  {table:<12} {n:>6}")

    print("\n[DONE] Demo data reset complete.\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Reset Stockwise-CRM inventory demo data. "
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
