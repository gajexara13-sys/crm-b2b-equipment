from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, DateTime, Numeric
from sqlalchemy.sql import func
from app.database import Base

class Request(Base):
    __tablename__ = "requests"
    id            = Column(Integer, primary_key=True)
    client_id     = Column(Integer, ForeignKey("clients.id"))
    number        = Column(String, unique=True)
    # Тип заявки: 'product' (товар) / 'service' (услуга) / 'complex' (комплекс)
    request_kind  = Column(String, default="product", index=True)
    material_type = Column(String)
    test_types    = Column(Text)
    quantity      = Column(Integer, default=1)
    urgency       = Column(String, default="normal")
    price         = Column(Numeric(12,2))
    status        = Column(String, default="new")  # new|kp|contract|in_progress|done|cancelled
    assigned_to   = Column(Integer, ForeignKey("users.id"))
    notes         = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    stage       = Column(String, default="new_request")
    contact_name = Column(String)
    source = Column(String)
    material_category_id = Column(Integer, ForeignKey("material_categories.id"))
    material_test_object_id = Column(Integer, ForeignKey("material_test_objects.id"))
    material_variant = Column(String)
    selected_price_position_ids_json = Column(Text)
    selected_indicator_ids_json = Column(Text)
