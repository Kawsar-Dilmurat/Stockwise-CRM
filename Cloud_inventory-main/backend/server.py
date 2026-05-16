"""FastAPI entrypoint — Cloud Inventory Management System."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Configure logging early.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("inventory")

from app.db.session import Base, engine  # noqa: E402
from app.models import Activity, Customer, Lead, Product, Restock, Sale, Supplier  # noqa: E402,F401
from app.routes import (  # noqa: E402
    activities,
    crm_dashboard,
    customers,
    health,
    insights,
    leads,
    products,
    restocks,
    sales,
    suppliers,
)
from app.utils.seed import seed_if_empty  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create tables (simple migration strategy for a 1-week project).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent upgrade for the pre-supplier schema.
        from sqlalchemy import text
        await conn.execute(
            text(
                "ALTER TABLE restocks ADD COLUMN IF NOT EXISTS supplier_id "
                "INTEGER REFERENCES suppliers(id) ON DELETE SET NULL"
            )
        )
        await conn.execute(
            text("ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price INTEGER")
        )
        # Quote fields on leads — plain INTEGER, no FK constraint for demo safety.
        await conn.execute(
            text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS product_id INTEGER")
        )
        await conn.execute(
            text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS quantity INTEGER")
        )
        await conn.execute(
            text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS discount INTEGER")
        )
        await conn.execute(
            text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_fee INTEGER")
        )
        # Fix FK cascade: customer deletion now auto-deletes related leads and activities.
        await conn.execute(
            text("ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_customer_id_fkey")
        )
        await conn.execute(
            text(
                "ALTER TABLE leads ADD CONSTRAINT leads_customer_id_fkey "
                "FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE"
            )
        )
        await conn.execute(
            text("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_customer_id_fkey")
        )
        await conn.execute(
            text(
                "ALTER TABLE activities ADD CONSTRAINT activities_customer_id_fkey "
                "FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE"
            )
        )
    logger.info("db.tables.ready")
    await seed_if_empty()
    yield
    await engine.dispose()


app = FastAPI(
    title="Cloud Inventory Management System",
    version="1.0.0",
    description="Inventory + sales tracker with rule-based AI restock insights.",
    lifespan=lifespan,
)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "inventory", "status": "ready"}


api_router.include_router(health.router)
api_router.include_router(products.router)
api_router.include_router(sales.router)
api_router.include_router(restocks.router)
api_router.include_router(suppliers.router)
api_router.include_router(customers.router)
api_router.include_router(leads.router)
api_router.include_router(activities.router)
api_router.include_router(crm_dashboard.router)
api_router.include_router(insights.router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
