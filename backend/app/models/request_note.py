from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base

class RequestNote(Base):
    __tablename__ = "request_notes"
    id         = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("requests.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id  = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note_type  = Column(String, default="note")   # call | meeting | note | agreement | email | file
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
