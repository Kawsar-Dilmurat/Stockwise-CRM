"""Supplier endpoints — minimal CRUD + top-suppliers aggregation."""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Restock, Supplier
from app.schemas.supplier import (
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
    TopSupplier,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(payload: SupplierCreate, db: AsyncSession = Depends(get_db)):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail=f"Supplier '{payload.name}' already exists."
        )
    await db.refresh(supplier)
    logger.info("supplier.created id=%s name=%s", supplier.id, supplier.name)
    return supplier


@router.get("", response_model=List[SupplierOut])
async def list_suppliers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Supplier).order_by(Supplier.name))
    return result.scalars().all()


@router.get("/top", response_model=List[TopSupplier])
async def top_suppliers(limit: int = 5, db: AsyncSession = Depends(get_db)):
    """Aggregate total units supplied and restock count per supplier."""
    stmt = (
        select(
            Supplier.id.label("supplier_id"),
            Supplier.name.label("name"),
            func.coalesce(func.sum(Restock.quantity), 0).label("total_units"),
            func.count(Restock.id).label("restock_count"),
        )
        .join(Restock, Restock.supplier_id == Supplier.id)
        .group_by(Supplier.id, Supplier.name)
        .order_by(func.coalesce(func.sum(Restock.quantity), 0).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        TopSupplier(
            supplier_id=r.supplier_id,
            name=r.name,
            total_units=int(r.total_units),
            restock_count=int(r.restock_count),
        )
        for r in rows
    ]


@router.get("/{supplier_id}", response_model=SupplierOut)
async def get_supplier(supplier_id: int, db: AsyncSession = Depends(get_db)):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.put("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: int, payload: SupplierUpdate, db: AsyncSession = Depends(get_db)
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, k, v)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Supplier name already exists.")
    await db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(supplier_id: int, db: AsyncSession = Depends(get_db)):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    # ON DELETE SET NULL keeps historical restock records intact.
    await db.delete(supplier)
    await db.commit()
    logger.info("supplier.deleted id=%s", supplier_id)
    return None
