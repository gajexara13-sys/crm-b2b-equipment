from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base

class Protocol(Base):
    __tablename__ = "protocols"
    id            = Column(Integer, primary_key=True)
    number        = Column(Integer, unique=True, nullable=False)  # порядковый номер
    sample_id     = Column(Integer, ForeignKey("samples.id"))
    test_id       = Column(Integer, ForeignKey("tests.id"))
    status        = Column(String, default="draft")  # draft|review|signed|sent
    conclusion    = Column(Text)
    notes         = Column(Text)
    laborant_id   = Column(Integer, ForeignKey("users.id"))
    lab_head_id   = Column(Integer, ForeignKey("users.id"))
    signed_at     = Column(DateTime(timezone=True))
    sent_at       = Column(DateTime(timezone=True))
    file_path     = Column(String)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
