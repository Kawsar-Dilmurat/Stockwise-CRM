"""Pydantic schemas for inventory insights and AI summaries."""
from typing import List, Literal, Optional
from pydantic import BaseModel

UrgencyLevel = Literal["HEALTHY", "WATCH", "LOW", "MODERATE", "HIGH", "CRITICAL"]


class ProductInsight(BaseModel):
    product_id: int
    name: str
    sku: str
    category: str
    stock_qty: int
    reorder_threshold: int
    recent_7_day_sales: int
    avg_daily_sales: float
    estimated_days_left: Optional[float]  # None when avg daily sales == 0
    reorder_flag: bool
    suggested_reorder_qty: int
    urgency: UrgencyLevel


class LowStockResponse(BaseModel):
    count: int
    items: List[ProductInsight]


class AISummaryResponse(BaseModel):
    product_id: Optional[int] = None
    summary: str
    insight: Optional[ProductInsight] = None
    provider: str


class DailyAISummaryResponse(BaseModel):
    summary: str
    low_stock_count: int
    items: List[ProductInsight]
    provider: str
