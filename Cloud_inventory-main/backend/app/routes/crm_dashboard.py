"""CRM dashboard endpoint — aggregated pipeline and activity summary."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Activity, Customer, Lead
from app.schemas.crm_dashboard import CRMDashboard

router = APIRouter(prefix="/crm", tags=["crm"])


@router.get("/dashboard", response_model=CRMDashboard)
async def get_crm_dashboard(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)

    customers = (await db.execute(select(Customer))).scalars().all()
    leads = (await db.execute(select(Lead))).scalars().all()
    follow_ups = (
        await db.execute(
            select(Activity).where(
                Activity.activity_type == "FOLLOW_UP",
                Activity.completed.is_(False),
                Activity.due_date.isnot(None),
            )
        )
    ).scalars().all()

    open_leads = [l for l in leads if l.stage not in ("WON", "LOST")]
    won_leads = [l for l in leads if l.stage == "WON"]
    lost_leads = [l for l in leads if l.stage == "LOST"]

    return CRMDashboard(
        total_customers=len(customers),
        total_leads=len(leads),
        open_leads=len(open_leads),
        won_leads=len(won_leads),
        lost_leads=len(lost_leads),
        upcoming_follow_ups=sum(1 for a in follow_ups if a.due_date >= now),
        overdue_follow_ups=sum(1 for a in follow_ups if a.due_date < now),
        open_estimated_value=sum(l.estimated_value for l in open_leads),
        open_weighted_value=sum(
            l.estimated_value * l.close_probability / 100 for l in open_leads
        ),
        won_value=sum(l.estimated_value for l in won_leads),
        lost_value=sum(l.estimated_value for l in lost_leads),
    )
