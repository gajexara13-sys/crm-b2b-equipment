from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class PricePositionIndicator(Base):
    """Связка прайсовой позиции с показателем области аккредитации."""

    __tablename__ = "price_position_indicators"

    id = Column(Integer, primary_key=True)
    price_position_id = Column(Integer, ForeignKey("price_positions.id"), nullable=False)
    test_indicator_id = Column(Integer, ForeignKey("test_indicators.id"), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
