from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Client(Base):
    __tablename__ = "clients"
    id           = Column(Integer, primary_key=True)
    name         = Column(String, nullable=False)
    inn          = Column(String)
    kpp          = Column(String)
    address      = Column(Text)
    contact_name = Column(String)
    contact_phone= Column(String)
    contact_email= Column(String)
    notes        = Column(Text)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
