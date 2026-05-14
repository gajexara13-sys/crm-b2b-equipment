from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Sample(Base):
    __tablename__ = "samples"
    id                  = Column(Integer, primary_key=True)
    lab_number          = Column(String, unique=True, nullable=False)
    request_id          = Column(Integer, ForeignKey("requests.id"))
    material_type       = Column(String)   # abs_58401|abs_58406|pbv|crushed_stone|sand
    material_name       = Column(String)
    material_grade      = Column(String)
    manufacturer        = Column(String)
    sampling_date       = Column(Date)
    registration_date   = Column(Date)
    sampling_location   = Column(Text)
    sampled_by          = Column(String)
    sampling_conditions = Column(Text)
    act_type            = Column(String)   # intake|sampling
    status              = Column(String, default="registered")  # registered|in_progress|done
    material_norm_id    = Column(Integer, ForeignKey("material_norms.id"), nullable=True)
    primary_nd_json     = Column(Text)  # JSON: выбранные НД по материалу (столб. 2)
    additional_nd_json  = Column(Text)  # JSON: доп. НД (столб. 3)
    methodology_catalog_json = Column(Text)  # JSON: id позиций каталога (методики/показатели)
    selected_price_position_ids_json = Column(Text)  # JSON: id PricePosition, выбранные в заявке/пробе
    selected_indicator_ids_json = Column(Text)  # JSON: id TestIndicator из справочника (показатели по материалу)
    material_category_id = Column(Integer, ForeignKey("material_categories.id"), nullable=True)
    material_test_object_id = Column(Integer, ForeignKey("material_test_objects.id"), nullable=True)
    material_variant = Column(String)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
