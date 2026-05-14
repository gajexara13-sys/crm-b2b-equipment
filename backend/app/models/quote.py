from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False, index=True)

    number = Column(String, unique=True, index=True)
    version = Column(Integer, default=1)
    status = Column(String, default="draft")
    total = Column(Float, default=0)
    margin_pct = Column(Float, default=0)
    valid_until = Column(Date)
    file_path = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
