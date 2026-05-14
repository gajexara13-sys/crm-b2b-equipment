from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    inn = Column(String, unique=True, index=True)
    kpp = Column(String)
    ogrn = Column(String)
    city = Column(String)
    region = Column(String)
    address = Column(Text)
    segment = Column(String)
    source_default = Column(String)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
