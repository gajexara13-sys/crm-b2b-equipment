from sqlalchemy import Column, Integer, Text, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class PricePosition(Base):
    """Позиция прайса, которую выбирает менеджер в заявке."""

    __tablename__ = "price_positions"

    id = Column(Integer, primary_key=True)
    test_object_id = Column(Integer, ForeignKey("material_test_objects.id"), nullable=True)
    price_code = Column(Text, nullable=False)
    display_name = Column(Text, nullable=True)
    price_rub = Column(Float, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
