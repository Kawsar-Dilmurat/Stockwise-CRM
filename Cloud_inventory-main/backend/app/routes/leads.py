"""Lead endpoints — CRM sales pipeline CRUD."""
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Customer, Lead
from app.models.lead import STAGE_PROBABILITY, VALID_STAGES
from app.schemas.lead import LeadCreate, LeadOut, LeadUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["leads"])


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(payload: LeadCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    if data["stage"] not in VALID_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage '{data['stage']}'. Valid stages: {sorted(VALID_STAGES)}.",
        )
    customer = await db.get(Customer, data["customer_id"])
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if data.get("close_probability") is None:
        data["close_probability"] = STAGE_PROBABILITY[data["stage"]]
    lead = Lead(**data)
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    logger.info("lead.created id=%s title=%s", lead.id, lead.title)
    return lead


@router.get("", response_model=List[LeadOut])
async def list_leads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lead).order_by(Lead.created_at.desc()))
    return result.scalars().all()


# Registered before /{lead_id} to avoid FastAPI treating "customer" as an int.
@router.get("/customer/{customer_id}", response_model=List[LeadOut])
async def list_leads_by_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    result = await db.execute(
        select(Lead)
        .where(Lead.customer_id == customer_id)
        .order_by(Lead.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.put("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: int, payload: LeadUpdate, db: AsyncSession = Depends(get_db)
):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    updates = payload.model_dump(exclude_unset=True)
    if "stage" in updates:
        if updates["stage"] not in VALID_STAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid stage '{updates['stage']}'. Valid stages: {sorted(VALID_STAGES)}.",
            )
        if "close_probability" not in updates:
            updates["close_probability"] = STAGE_PROBABILITY[updates["stage"]]
    if "customer_id" in updates:
        customer = await db.get(Customer, updates["customer_id"])
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
    for k, v in updates.items():
        setattr(lead, k, v)
    lead.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.delete(lead)
    await db.commit()
    logger.info("lead.deleted id=%s", lead_id)
    return None
