"""Activity SQLAlchemy model — CRM interaction and task tracking."""
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.db.session import Base

VALID_ACTIVITY_TYPES = {"INTERACTION", "NOTE", "FOLLOW_UP"}
VALID_COMMUNICATION_METHODS = {"CALL", "EMAIL", "MEETING"}


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    customer_id = Column(
        Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_id = Column(
        Integer, ForeignKey("leads.id"), nullable=True, index=True
    )
    activity_type = Column(String(50), nullable=False)
    communication_method = Column(String(50), nullable=True)
    note = Column(String(1000), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
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

    customer = relationship("Customer", back_populates="activities")
    lead = relationship("Lead", back_populates="activities")
