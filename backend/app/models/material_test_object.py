from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class MaterialTestObject(Base):
    """Объект испытаний (материал) внутри категории."""

    __tablename__ = "material_test_objects"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("material_categories.id"), nullable=False)
    name = Column(Text, nullable=False)
    variants_json = Column(Text)  # JSON: список строк — марка / класс / фракция (опционально)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
