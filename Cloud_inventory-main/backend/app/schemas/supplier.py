"""Pydantic schemas for suppliers."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact: Optional[str] = Field(None, max_length=255)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact: Optional[str] = Field(None, max_length=255)


class SupplierOut(SupplierBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class SupplierMini(BaseModel):
    """Compact form for nesting inside restock responses."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class TopSupplier(BaseModel):
    supplier_id: int
    name: str
    total_units: int
    restock_count: int
