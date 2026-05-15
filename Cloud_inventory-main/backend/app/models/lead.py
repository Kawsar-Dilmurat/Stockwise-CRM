"""Lead SQLAlchemy model — CRM sales pipeline tracking."""
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base

VALID_STAGES = {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"}

STAGE_PROBABILITY = {
    "NEW": 10,
    "CONTACTED": 25,
    "QUALIFIED": 50,
    "PROPOSAL": 70,
    "WON": 100,
    "LOST": 0,
}


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(
        Integer, ForeignKey("customers.id"), nullable=False, index=True
    )
    title = Column(String(255), nullable=False)
    source = Column(String(100), nullable=True)
    stage = Column(String(50), nullable=False, default="NEW")
    estimated_value = Column(Integer, nullable=False, default=0)
    close_probability = Column(Integer, nullable=False, default=10)
    owner = Column(String(255), nullable=True)
    next_follow_up_date = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String(1000), nullable=True)
    # Quote fields — intentionally plain INTEGER (no FK constraint) to keep migrations safe.
    product_id = Column(Integer, nullable=True)
    quantity = Column(Integer, nullable=True)
    discount = Column(Integer, nullable=True)
    delivery_fee = Column(Integer, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    customer = relationship("Customer", back_populates="leads")
    activities = relationship(
        "Activity",
        back_populates="lead",
        passive_deletes=True,
    )
