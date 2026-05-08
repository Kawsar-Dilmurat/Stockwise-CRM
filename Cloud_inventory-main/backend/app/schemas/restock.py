"""Pydantic schemas for restock records (inbound inventory)."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.supplier import SupplierMini


class RestockCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    note: Optional[str] = Field(None, max_length=255)
    supplier_id: Optional[int] = Field(None, gt=0)


class RestockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    note: Optional[str]
    restocked_at: datetime
    supplier_id: Optional[int] = None
    supplier: Optional[SupplierMini] = None
