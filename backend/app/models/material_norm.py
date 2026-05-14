from sqlalchemy import Column, Integer, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class MaterialNorm(Base):
    """
    Справочник: категория → объект испытаний → перечни НД (основные и дополнительные из CSV).
    """

    __tablename__ = "material_norms"

    id = Column(Integer, primary_key=True)
    category_label = Column(Text, nullable=False, default="")
    material_label = Column(Text, nullable=False)
    primary_standards_json = Column(Text, nullable=False)
    additional_standards_json = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
