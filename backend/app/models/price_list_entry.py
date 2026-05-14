from sqlalchemy import Column, Integer, Text, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class PriceListEntry(Base):
    """Прайсовое обозначение и цена для показателя (может отличаться от формулировок аккредитации)."""

    __tablename__ = "price_list_entries"

    id = Column(Integer, primary_key=True)
    test_indicator_id = Column(Integer, ForeignKey("test_indicators.id"), unique=True, nullable=False)
    price_code = Column(Text)  # прайсовое обозначение
    price_rub = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
