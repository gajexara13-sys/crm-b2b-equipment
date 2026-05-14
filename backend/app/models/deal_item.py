from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class DealItem(Base):
    __tablename__ = "deal_items"

    id = Column(Integer, primary_key=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)

    qty = Column(Float, default=1)
    unit_cost = Column(Float, default=0)
    unit_price = Column(Float, default=0)
    discount_pct = Column(Float, default=0)

    line_total = Column(Float, default=0)
    line_margin = Column(Float, default=0)
    line_margin_pct = Column(Float, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
