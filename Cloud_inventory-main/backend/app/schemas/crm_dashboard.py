"""Pydantic schema for the CRM dashboard summary."""
from pydantic import BaseModel


class CRMDashboard(BaseModel):
    total_customers: int
    total_leads: int
    open_leads: int
    won_leads: int
    lost_leads: int
    upcoming_follow_ups: int
    overdue_follow_ups: int
    open_estimated_value: int
    open_weighted_value: float
    won_value: int
    lost_value: int
