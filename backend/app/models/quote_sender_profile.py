from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime
from sqlalchemy.sql import func

from app.database import Base


class QuoteSenderProfile(Base):
    __tablename__ = "quote_sender_profiles"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    legal_form = Column(String)
    legal_name = Column(String, nullable=False)
    legal_address = Column(Text)
    tax_number = Column(String)
    kpp = Column(String)
    ogrn = Column(String)
    email = Column(String)
    phone = Column(String)
    website = Column(String)
    signer_name = Column(String)
    signer_position = Column(String)
    logo_url = Column(Text)
    signature_url = Column(Text)
    stamp_url = Column(Text)
    default_currency = Column(String, default="RUB")
    vat_rate = Column(Float, default=20.0)
    is_active = Column(Boolean, default=True)
    intro_template = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
