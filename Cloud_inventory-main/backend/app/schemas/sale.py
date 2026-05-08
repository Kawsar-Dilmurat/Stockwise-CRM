"""Pydantic schemas for sales."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SaleCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    sold_at: datetime
