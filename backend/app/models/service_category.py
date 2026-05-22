from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


class ServiceCategory(Base):
    __tablename__ = "service_categories"
    id         = Column(Integer, primary_key=True)
    name       = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ServiceSubcategory(Base):
    __tablename__ = "service_subcategories"
    id          = Column(Integer, primary_key=True)
    category_id = Column(Integer, nullable=False, index=True)
    name        = Column(String, nullable=False)
    sort_order  = Column(Integer, default=0)


class ServiceItem(Base):
    __tablename__ = "service_items"
    id              = Column(Integer, primary_key=True)
    subcategory_id  = Column(Integer, nullable=False, index=True)
    name            = Column(String, nullable=False)
    description     = Column(String, nullable=True)
    price_rub       = Column(Integer, nullable=True)
    unit            = Column(String, nullable=True)
    duration        = Column(String, nullable=True)
    notes           = Column(String, nullable=True)
    sort_order      = Column(Integer, default=0)
    created_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
