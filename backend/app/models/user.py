from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True)
    email      = Column(String, unique=True, nullable=False)
    name       = Column(String, nullable=False)
    role       = Column(String, default="laborant")  # admin|lab_head|laborant|manager
    hashed_pwd = Column(String, nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
