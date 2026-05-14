from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, Date, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True, index=True)

    name = Column(String, nullable=False)
    source = Column(String, nullable=False, index=True)
    category_code = Column(String)
    stage = Column(String, default="new_lead", index=True)
    probability = Column(Integer, default=10)

    amount = Column(Float, default=0)
    gross_margin = Column(Float, default=0)
    margin_pct = Column(Float, default=0)

    next_step = Column(String, nullable=False)
    next_step_date = Column(Date, nullable=False)
    deadline = Column(Date)

    status = Column(String, default="open")
    loss_reason = Column(String)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
