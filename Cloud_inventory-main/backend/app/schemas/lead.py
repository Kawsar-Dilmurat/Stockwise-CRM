"""Pydantic schemas for leads."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class LeadBase(BaseModel):
    customer_id: int
    title: str = Field(..., min_length=1, max_length=255)
    source: Optional[str] = Field(None, max_length=100)
    stage: str = Field("NEW", max_length=50)
    estimated_value: int = Field(0, ge=0)
    close_probability: Optional[int] = Field(None, ge=0, le=100)
    owner: Optional[str] = Field(None, max_length=255)
    next_follow_up_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    customer_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    source: Optional[str] = Field(None, max_length=100)
    stage: Optional[str] = Field(None, max_length=50)
    estimated_value: Optional[int] = Field(None, ge=0)
    close_probability: Optional[int] = Field(None, ge=0, le=100)
    owner: Optional[str] = Field(None, max_length=255)
    next_follow_up_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)


class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class LeadMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    stage: str
    close_probability: int
