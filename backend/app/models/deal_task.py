from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base

# task_type: call | kp | meeting | payment
class DealTask(Base):
    __tablename__ = "deal_tasks"
    id           = Column(Integer, primary_key=True)
    request_id   = Column(Integer, ForeignKey("requests.id"), nullable=False)
    assigned_to  = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_type    = Column(String, nullable=False)
    due_at       = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    note         = Column(Text, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
