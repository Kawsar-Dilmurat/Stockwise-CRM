"""Restock endpoints — inbound inventory movements."""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models import Product, Restock, Supplier
from app.schemas.restock import RestockCreate, RestockOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/restocks", tags=["restocks"])


@router.post("", response_model=RestockOut, status_code=status.HTTP_201_CREATED)
async def create_restock(payload: RestockCreate, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.supplier_id is not None:
        supplier = await db.get(Supplier, payload.supplier_id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

    product.stock_qty += payload.quantity
    restock = Restock(
        product_id=payload.product_id,
        quantity=payload.quantity,
        note=payload.note,
        supplier_id=payload.supplier_id,
    )
    db.add(restock)
    await db.commit()

    # Re-load with supplier eager-loaded for the response.
    result = await db.execute(
        select(Restock)
        .options(selectinload(Restock.supplier))
        .where(Restock.id == restock.id)
    )
    fresh = result.scalar_one()
    logger.info(
        "restock.created id=%s product_id=%s supplier_id=%s qty=%s new_stock=%s",
        fresh.id,
        product.id,
        fresh.supplier_id,
        fresh.quantity,
        product.stock_qty,
    )
    return fresh


@router.get("", response_model=List[RestockOut])
async def list_restocks(
    supplier_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Restock)
        .options(selectinload(Restock.supplier))
        .order_by(Restock.restocked_at.desc())
        .limit(500)
    )
    if supplier_id is not None:
        # supplier_id=0 is treated as "no supplier" (NULL match) for convenience.
        if supplier_id == 0:
            stmt = stmt.where(Restock.supplier_id.is_(None))
        else:
            stmt = stmt.where(Restock.supplier_id == supplier_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/product/{product_id}", response_model=List[RestockOut])
async def list_restocks_for_product(
    product_id: int, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    result = await db.execute(
        select(Restock)
        .options(selectinload(Restock.supplier))
        .where(Restock.product_id == product_id)
        .order_by(Restock.restocked_at.desc())
    )
    return result.scalars().all()
