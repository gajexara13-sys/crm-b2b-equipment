from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, Date, DateTime, Boolean
from sqlalchemy.sql import func

from app.database import Base


class CommercialQuote(Base):
    __tablename__ = "commercial_quotes"

    id = Column(Integer, primary_key=True)
    number = Column(String, unique=True, index=True)
    status = Column(String, default="draft")
    quote_date = Column(Date)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=True, index=True)

    sender_profile_id = Column(Integer, ForeignKey("quote_sender_profiles.id"), nullable=True)
    recipient_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    recipient_name = Column(String)
    recipient_address = Column(Text)
    recipient_contact_name = Column(String)
    recipient_contact_position = Column(String)
    recipient_contact_phone = Column(String)
    recipient_contact_email = Column(String)
    greeting_name = Column(String)

    intro_text = Column(Text)
    show_discount_column = Column(Boolean, default=True)
    currency = Column(String, default="RUB")
    vat_rate = Column(Float, default=20.0)
    fx_rate = Column(Float, default=1.0)

    subtotal = Column(Float, default=0.0)
    discount_total = Column(Float, default=0.0)
    total_with_vat = Column(Float, default=0.0)

    terms_template_id = Column(Integer, ForeignKey("quote_terms_templates.id"), nullable=True)
    terms_production_country = Column(Text)
    terms_warranty = Column(Text)
    terms_delivery = Column(Text)
    terms_payment = Column(Text)
    terms_currency_note = Column(Text)
    terms_address_note = Column(Text)
    terms_price_validity = Column(Text)
    terms_lead_time = Column(Text)

    request_id = Column(Integer, ForeignKey("requests.id"), nullable=True, index=True)

    pdf_file_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CommercialQuoteItem(Base):
    __tablename__ = "commercial_quote_items"

    id = Column(Integer, primary_key=True)
    quote_id = Column(Integer, ForeignKey("commercial_quotes.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    sort_order = Column(Integer, default=0)
    title = Column(String, nullable=False)
    model = Column(String)
    country = Column(String)
    intro = Column(Text)
    features_text = Column(Text)
    kit_text = Column(Text)
    specs_json = Column(Text)
    photo_urls_json = Column(Text)

    show_intro = Column(Boolean, default=True)
    show_features = Column(Boolean, default=True)
    show_kit = Column(Boolean, default=True)
    show_specs = Column(Boolean, default=True)
    show_photos = Column(Boolean, default=True)

    quantity = Column(Float, default=1.0)
    price_without_vat = Column(Float, default=0.0)
    price_with_vat = Column(Float, default=0.0)
    discount_pct = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    line_total_with_vat = Column(Float, default=0.0)
    line_total_discounted = Column(Float, default=0.0)

    calibration_included = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
