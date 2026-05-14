from sqlalchemy import Column, Integer, String, Text, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base


class CatalogItem(Base):
    """
    Строка каталога (область аккредитации + цена в CRM).

    material_object — столб. 1: виды материалов (в т.ч. несколько через перенос
      строк в одной ячейке при выгрузке из Excel).
    characteristic — столб. 2: показатель.
    range_text — столб. 3: диапазон измерений.
    standard_ref — столб. 4: НД по методике.
    price_rub — заполняется вручную в приложении (в исходном файле не было).
    """

    __tablename__ = "catalog_items"

    id = Column(Integer, primary_key=True)
    material_object = Column(Text, nullable=False)
    characteristic = Column(Text, nullable=False)
    range_text = Column(Text)
    standard_ref = Column(Text)
    price_rub = Column(Float)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
