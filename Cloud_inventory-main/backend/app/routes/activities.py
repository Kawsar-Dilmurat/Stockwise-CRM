"""Activity endpoints — CRM interaction and task tracking CRUD."""
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Activity, Customer, Lead
from app.models.activity import VALID_ACTIVITY_TYPES, VALID_COMMUNICATION_METHODS
from app.schemas.activity import ActivityCreate, ActivityOut, ActivityUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
async def create_activity(payload: ActivityCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    if data["activity_type"] not in VALID_ACTIVITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid activity_type '{data['activity_type']}'. Valid types: {sorted(VALID_ACTIVITY_TYPES)}.",
        )
    if data.get("communication_method") and data["communication_method"] not in VALID_COMMUNICATION_METHODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid communication_method '{data['communication_method']}'. Valid methods: {sorted(VALID_COMMUNICATION_METHODS)}.",
        )
    if data["activity_type"] == "INTERACTION" and not data.get("communication_method"):
        raise HTTPException(
            status_code=400,
            detail="communication_method is required when activity_type is INTERACTION.",
        )
    customer = await db.get(Customer, data["customer_id"])
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if data.get("lead_id"):
        lead = await db.get(Lead, data["lead_id"])
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        if lead.customer_id != data["customer_id"]:
            raise HTTPException(
                status_code=400,
                detail="Lead does not belong to the specified customer.",
            )
    if data["completed"] is True and not data["completed_at"]:
        data["completed_at"] = datetime.now(timezone.utc)
    activity = Activity(**data)
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    logger.info("activity.created id=%s type=%s", activity.id, activity.activity_type)
    return activity


@router.get("", response_model=List[ActivityOut])
async def list_activities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity).order_by(Activity.created_at.desc()))
    return result.scalars().all()


# Registered before /{activity_id} to avoid FastAPI treating "customer" as an int.
@router.get("/customer/{customer_id}", response_model=List[ActivityOut])
async def list_activities_by_customer(
    customer_id: int, db: AsyncSession = Depends(get_db)
):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    result = await db.execute(
        select(Activity)
        .where(Activity.customer_id == customer_id)
        .order_by(Activity.created_at.desc())
    )
    return result.scalars().all()


# Registered before /{activity_id} to avoid FastAPI treating "lead" as an int.
@router.get("/lead/{lead_id}", response_model=List[ActivityOut])
async def list_activities_by_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    result = await db.execute(
        select(Activity)
        .where(Activity.lead_id == lead_id)
        .order_by(Activity.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{activity_id}", response_model=ActivityOut)
async def get_activity(activity_id: int, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.put("/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: int, payload: ActivityUpdate, db: AsyncSession = Depends(get_db)
):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    updates = payload.model_dump(exclude_unset=True)
    if "activity_type" in updates and updates["activity_type"] not in VALID_ACTIVITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid activity_type '{updates['activity_type']}'. Valid types: {sorted(VALID_ACTIVITY_TYPES)}.",
        )
    if (
        "communication_method" in updates
        and updates["communication_method"]
        and updates["communication_method"] not in VALID_COMMUNICATION_METHODS
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid communication_method '{updates['communication_method']}'. Valid methods: {sorted(VALID_COMMUNICATION_METHODS)}.",
        )
    effective_type = updates.get("activity_type", activity.activity_type)
    effective_method = updates.get("communication_method", activity.communication_method)
    if effective_type == "INTERACTION" and not effective_method:
        raise HTTPException(
            status_code=400,
            detail="communication_method is required when activity_type is INTERACTION.",
        )
    if "customer_id" in updates:
        customer = await db.get(Customer, updates["customer_id"])
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
    if updates.get("lead_id"):
        lead = await db.get(Lead, updates["lead_id"])
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        effective_customer_id = updates.get("customer_id", activity.customer_id)
        if lead.customer_id != effective_customer_id:
            raise HTTPException(
                status_code=400,
                detail="Lead does not belong to the specified customer.",
            )
    if "completed" in updates:
        if updates["completed"] is True and "completed_at" not in updates:
            updates["completed_at"] = datetime.now(timezone.utc)
        elif updates["completed"] is False and "completed_at" not in updates:
            updates["completed_at"] = None
    for k, v in updates.items():
        setattr(activity, k, v)
    activity.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(activity_id: int, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.delete(activity)
    await db.commit()
    logger.info("activity.deleted id=%s", activity_id)
    return None


@router.patch("/{activity_id}/complete", response_model=ActivityOut)
async def complete_activity(activity_id: int, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    activity.completed = True
    activity.completed_at = datetime.now(timezone.utc)
    activity.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(activity)
    return activity
