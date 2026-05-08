"""Product SQLAlchemy model."""
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    sku = Column(String(64), unique=True, nullable=False, index=True)
    category = Column(String(128), nullable=False, default="general")
    stock_qty = Column(Integer, nullable=False, default=0)
    reorder_threshold = Column(Integer, nullable=False, default=10)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    sales = relationship(
        "Sale",
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    restocks = relationship(
        "Restock",
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
