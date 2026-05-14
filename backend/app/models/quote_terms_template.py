from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.database import Base


class QuoteTermsTemplate(Base):
    __tablename__ = "quote_terms_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    warranty_terms = Column(Text)
    delivery_terms = Column(Text)
    payment_terms = Column(Text)
    production_country = Column(Text)
    currency_note = Column(Text)
    address_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
