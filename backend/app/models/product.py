from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("product_categories.id"), nullable=True, index=True)

    sku = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=False)
    unit = Column(String, default="шт")
    description = Column(Text)

    tech_specs = Column(Text)
    warranty_terms = Column(String)
    delivery_terms = Column(String)

    cost_with_vat = Column(Float, default=0)
    price_dealers_vat = Column(Float, default=0)
    price_end_vat = Column(Float, default=0)

    weight_net_kg = Column(Float)
    weight_gross_kg = Column(Float)
    volume_m3 = Column(Float)
    length_cm = Column(Float)
    width_cm = Column(Float)
    height_cm = Column(Float)

    related_product_ids_json = Column(Text)
    analog_product_ids_json = Column(Text)
    stock_quantity = Column(Integer, default=0)

    brand = Column(String)
    product_status = Column(String, default="draft")
    equipment_type = Column(String)
    website_url = Column(Text)
    photo_urls_json = Column(Text)

    purchase_cost = Column(Float, default=0)
    logistics_cost = Column(Float, default=0)
    extra_cost = Column(Float, default=0)
    target_margin_pct = Column(Float, default=30)
    recommended_price = Column(Float, default=0)
    min_price = Column(Float, default=0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
