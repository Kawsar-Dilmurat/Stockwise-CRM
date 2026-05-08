"""Seed demo data on startup if database is empty."""
import logging
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from app.models import Product, Restock, Sale, Supplier

logger = logging.getLogger(__name__)


DEMO_SUPPLIERS = [
    {"name": "Acme Wholesale Co.", "contact": "orders@acmewholesale.com"},
    {"name": "Northgate Distributors", "contact": "+1 555-0142"},
    {"name": "BlueLeaf Imports", "contact": "sales@blueleaf.io"},
]


DEMO_PRODUCTS = [
    {"name": "Organic Coffee Beans 1kg", "sku": "COFF-001", "category": "Beverages", "stock_qty": 8, "reorder_threshold": 15},
    {"name": "Stainless Steel Water Bottle", "sku": "BOTL-220", "category": "Accessories", "stock_qty": 42, "reorder_threshold": 20},
    {"name": "Wireless Bluetooth Earbuds", "sku": "AUDIO-77", "category": "Electronics", "stock_qty": 5, "reorder_threshold": 10},
    {"name": "Cotton Tote Bag", "sku": "BAG-101", "category": "Accessories", "stock_qty": 60, "reorder_threshold": 25},
    {"name": "Premium Notebook A5", "sku": "NOTE-A5", "category": "Stationery", "stock_qty": 18, "reorder_threshold": 30},
    {"name": "USB-C Charging Cable", "sku": "CABL-USC", "category": "Electronics", "stock_qty": 3, "reorder_threshold": 12},
    {"name": "Scented Soy Candle", "sku": "CAND-SOY", "category": "Home", "stock_qty": 27, "reorder_threshold": 15},
    {"name": "Bamboo Toothbrush 4-pack", "sku": "TOOT-BAM", "category": "Personal Care", "stock_qty": 14, "reorder_threshold": 20},
]


async def seed_if_empty() -> None:
    async with AsyncSessionLocal() as db:
        # Suppliers: seed independently so upgrade paths also get demo data.
        existing_suppliers = (
            await db.execute(select(func.count(Supplier.id)))
        ).scalar() or 0
        if existing_suppliers == 0:
            db.add_all([Supplier(**s) for s in DEMO_SUPPLIERS])
            await db.commit()
            logger.info("seed.suppliers demo=%s", len(DEMO_SUPPLIERS))

        count = (await db.execute(select(func.count(Product.id)))).scalar() or 0
        if count > 0:
            logger.info("seed.skipped existing_products=%s", count)
            return

        products = [Product(**p) for p in DEMO_PRODUCTS]
        db.add_all(products)
        await db.flush()

        suppliers = (await db.execute(select(Supplier))).scalars().all()

        rng = random.Random(42)
        now = datetime.now(timezone.utc)
        for product in products:
            popularity = rng.choice([0.3, 0.6, 1.0, 1.5, 2.0])
            for day in range(7):
                sales_today = max(0, int(rng.gauss(popularity, 0.8)))
                for _ in range(sales_today):
                    qty = rng.randint(1, 3)
                    if product.stock_qty <= 0:
                        break
                    qty = min(qty, product.stock_qty)
                    sold_at = now - timedelta(
                        days=day, hours=rng.randint(0, 23), minutes=rng.randint(0, 59)
                    )
                    db.add(Sale(product_id=product.id, quantity=qty, sold_at=sold_at))
                    product.stock_qty -= qty

        # A few demo restocks against seeded suppliers so "Top suppliers" has data.
        if suppliers:
            for product, supplier in zip(products[:4], rng.choices(suppliers, k=4)):
                qty = rng.randint(10, 40)
                db.add(
                    Restock(
                        product_id=product.id,
                        supplier_id=supplier.id,
                        quantity=qty,
                        note=f"Initial delivery · PO-{rng.randint(1000, 9999)}",
                        restocked_at=now - timedelta(days=rng.randint(1, 6)),
                    )
                )
                product.stock_qty += qty

        await db.commit()
        logger.info("seed.complete products=%s", len(products))
