from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, DateTime, Float, JSON
from sqlalchemy.sql import func
from app.database import Base

class Test(Base):
    __tablename__ = "tests"
    id            = Column(Integer, primary_key=True)
    sample_id     = Column(Integer, ForeignKey("samples.id"))
    test_type     = Column(String)   # gost_58401|gost_58406
    laborant_id   = Column(Integer, ForeignKey("users.id"))
    status        = Column(String, default="draft")  # draft|done
    # Идентификационные данные АБС
    material_type = Column(String)   # тип смеси: плотная/пористая/высокопористая
    material_grade= Column(String)   # марка
    gost          = Column(String)
    # Результаты — хранятся как JSON для гибкости
    grain_composition    = Column(JSON)  # зерновой состав
    binder_content       = Column(JSON)  # содержание вяжущего
    max_density          = Column(JSON)  # максимальная плотность
    bulk_density         = Column(JSON)  # объёмная плотность
    air_voids            = Column(JSON)  # воздушные пустоты
    water_resistance     = Column(JSON)  # водостойкость
    dust_clay            = Column(JSON)  # пылеватые и глинистые
    notes         = Column(Text)
    tested_at     = Column(Date)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
