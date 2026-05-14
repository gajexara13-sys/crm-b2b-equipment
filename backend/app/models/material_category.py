from sqlalchemy import Column, Integer, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class MaterialCategory(Base):
    """Категория объектов испытаний (справочник)."""

    __tablename__ = "material_categories"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
