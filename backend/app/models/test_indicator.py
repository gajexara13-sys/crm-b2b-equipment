from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class TestIndicator(Base):
    """Определяемая характеристика (показатель) по области аккредитации для объекта испытаний."""

    __tablename__ = "test_indicators"

    id = Column(Integer, primary_key=True)
    test_object_id = Column(Integer, ForeignKey("material_test_objects.id"), nullable=False)
    characteristic = Column(Text, nullable=False)
    range_text = Column(Text)
    standard_ref = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
