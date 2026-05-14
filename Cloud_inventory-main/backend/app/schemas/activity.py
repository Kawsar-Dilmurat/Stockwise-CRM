"""Pydantic schemas for activities."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ActivityBase(BaseModel):
    customer_id: int
    lead_id: Optional[int] = None
    activity_type: str = Field(..., min_length=1, max_length=50)
    communication_method: Optional[str] = Field(None, max_length=50)
    note: str = Field(..., min_length=1, max_length=1000)
    due_date: Optional[datetime] = None
    completed: bool = False
    completed_at: Optional[datetime] = None


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    customer_id: Optional[int] = None
    lead_id: Optional[int] = None
    activity_type: Optional[str] = Field(None, min_length=1, max_length=50)
    communication_method: Optional[str] = Field(None, max_length=50)
    note: Optional[str] = Field(None, min_length=1, max_length=1000)
    due_date: Optional[datetime] = None
    completed: Optional[bool] = None
    completed_at: Optional[datetime] = None


class ActivityOut(ActivityBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ActivityMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activity_type: str
    communication_method: Optional[str] = None
    completed: bool
    due_date: Optional[datetime] = None
