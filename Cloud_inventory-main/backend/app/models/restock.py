"""Restock SQLAlchemy model — records inbound inventory movements."""
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class Restock(Base):
    __tablename__ = "restocks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id = Column(
        Integer,
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    quantity = Column(Integer, nullable=False)
    note = Column(String(255), nullable=True)
    restocked_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    product = relationship("Product", back_populates="restocks")
    supplier = relationship("Supplier", back_populates="restocks")
