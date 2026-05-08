"""Sales endpoints."""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Product, Sale
from app.schemas.sale import SaleCreate, SaleOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
async def create_sale(payload: SaleCreate, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock_qty < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient stock for '{product.name}'. "
                f"Available: {product.stock_qty}, requested: {payload.quantity}."
            ),
        )

    product.stock_qty -= payload.quantity
    sale = Sale(product_id=payload.product_id, quantity=payload.quantity)
    db.add(sale)
    await db.commit()
    await db.refresh(sale)
    logger.info(
        "sale.created id=%s product_id=%s qty=%s remaining_stock=%s",
        sale.id,
        product.id,
        sale.quantity,
        product.stock_qty,
    )
    return sale


@router.get("", response_model=List[SaleOut])
async def list_sales(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sale).order_by(Sale.sold_at.desc()).limit(500))
    return result.scalars().all()


@router.get("/product/{product_id}", response_model=List[SaleOut])
async def list_sales_for_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    result = await db.execute(
        select(Sale)
        .where(Sale.product_id == product_id)
        .order_by(Sale.sold_at.desc())
    )
    return result.scalars().all()
