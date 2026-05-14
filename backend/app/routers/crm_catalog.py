import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.models.product_category import ProductCategory
from app.routers.auth import get_current_user

router = APIRouter()


class ProductIn(BaseModel):
    category_id: Optional[int] = None
    sku: Optional[str] = None
    name: str
    unit: str = "шт"
    description: Optional[str] = None

    tech_specs: Optional[str] = None
    warranty_terms: Optional[str] = None
    delivery_terms: Optional[str] = None

    cost_with_vat: float = 0
    price_dealers_vat: float = 0
    price_end_vat: float = 0

    weight_net_kg: Optional[float] = None
    weight_gross_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None

    related_product_ids: Optional[List[int]] = Field(default=None)
    analog_product_ids: Optional[List[int]] = Field(default=None)
    stock_quantity: int = 0

    brand: Optional[str] = None
    product_status: str = "draft"
    equipment_type: Optional[str] = None
    website_url: Optional[str] = None
    photo_urls: Optional[List[str]] = Field(default=None)

    purchase_cost: float = 0
    logistics_cost: float = 0
    extra_cost: float = 0
    target_margin_pct: float = 30
    recommended_price: float = 0
    min_price: float = 0
    is_active: bool = True


def _lists_to_json(data: ProductIn) -> dict:
    d = data.model_dump()
    rel = d.pop("related_product_ids", None)
    ana = d.pop("analog_product_ids", None)
    photos = d.pop("photo_urls", None)
    if rel is not None:
        d["related_product_ids_json"] = json.dumps(rel, ensure_ascii=False)
    if ana is not None:
        d["analog_product_ids_json"] = json.dumps(ana, ensure_ascii=False)
    if photos is not None:
        d["photo_urls_json"] = json.dumps(photos, ensure_ascii=False)
    return d


@router.get("/categories")
def list_categories(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(ProductCategory).order_by(ProductCategory.id).all()


@router.get("/products")
def list_products(
    response: Response,
    category_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    q = db.query(Product)
    if category_id is not None:
        q = q.filter(Product.category_id == category_id)
    if is_active is not None:
        q = q.filter(Product.is_active == is_active)
    return q.order_by(Product.id.desc()).all()


@router.post("/products")
def create_product(data: ProductIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if data.category_id is not None:
        cat = db.query(ProductCategory).filter(ProductCategory.id == data.category_id).first()
        if not cat:
            raise HTTPException(404, "Категория не найдена")
    if data.sku:
        exists = db.query(Product).filter(Product.sku == data.sku).first()
        if exists:
            raise HTTPException(400, "Товар с таким артикулом уже есть")
    payload = _lists_to_json(data)
    p = Product(**payload)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/products/{id}")
def get_product(
    id: int,
    response: Response,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    p = db.query(Product).filter(Product.id == id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    return p


@router.put("/products/{id}")
def update_product(id: int, data: ProductIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Product).filter(Product.id == id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    if data.category_id is not None:
        cat = db.query(ProductCategory).filter(ProductCategory.id == data.category_id).first()
        if not cat:
            raise HTTPException(404, "Категория не найдена")
    if data.sku:
        exists = db.query(Product).filter(Product.sku == data.sku, Product.id != id).first()
        if exists:
            raise HTTPException(400, "Товар с таким артикулом уже есть")
    payload = _lists_to_json(data)
    for k, v in payload.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/products/{id}")
def delete_product(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Product).filter(Product.id == id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    db.delete(p)
    db.commit()
    return {"ok": True}
