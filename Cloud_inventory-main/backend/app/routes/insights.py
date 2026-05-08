"""Inventory-insight endpoints (rule-based + AI text)."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Product
from app.schemas.insight import (
    AISummaryResponse,
    DailyAISummaryResponse,
    LowStockResponse,
    ProductInsight,
)
from app.services.ai_service import get_ai_provider
from app.services.inventory_service import (
    compute_all_insights,
    compute_low_stock_insights,
    compute_product_insight,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/low-stock", response_model=LowStockResponse)
async def low_stock(db: AsyncSession = Depends(get_db)):
    items = await compute_low_stock_insights(db)
    return LowStockResponse(count=len(items), items=items)


@router.get("/all", response_model=list[ProductInsight])
async def all_insights(db: AsyncSession = Depends(get_db)):
    return await compute_all_insights(db)


@router.get("/product/{product_id}", response_model=ProductInsight)
async def product_insight(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return await compute_product_insight(db, product)


@router.post("/product/{product_id}/ai-summary", response_model=AISummaryResponse)
async def product_ai_summary(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    insight = await compute_product_insight(db, product)
    provider = get_ai_provider()
    text = provider.restock_recommendation(insight)
    logger.info(
        "ai.summary.product id=%s provider=%s flag=%s",
        product_id,
        provider.name,
        insight.reorder_flag,
    )
    return AISummaryResponse(
        product_id=product_id,
        summary=text,
        insight=insight,
        provider=provider.name,
    )


@router.post("/daily-ai-summary", response_model=DailyAISummaryResponse)
async def daily_ai_summary(db: AsyncSession = Depends(get_db)):
    items = await compute_low_stock_insights(db)
    provider = get_ai_provider()
    text = provider.daily_low_stock_summary(items)
    logger.info(
        "ai.summary.daily count=%s provider=%s", len(items), provider.name
    )
    return DailyAISummaryResponse(
        summary=text,
        low_stock_count=len(items),
        items=items,
        provider=provider.name,
    )
