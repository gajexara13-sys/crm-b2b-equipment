from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.service_category import ServiceCategory, ServiceSubcategory, ServiceItem
from app.routers.auth import get_current_user

router = APIRouter()


# ── Pydantic ────────────────────────────────────────────────────────────────

class ServiceItemIn(BaseModel):
    name:        str
    description: Optional[str] = None
    price_rub:   Optional[int] = None
    unit:        Optional[str] = None
    duration:    Optional[str] = None
    notes:       Optional[str] = None


def _item_dict(it: ServiceItem) -> dict:
    return {
        "id":             it.id,
        "subcategory_id": it.subcategory_id,
        "name":           it.name,
        "description":    it.description,
        "price_rub":      it.price_rub,
        "unit":           it.unit,
        "duration":       it.duration,
        "notes":          it.notes,
        "sort_order":     it.sort_order,
        "created_at":     it.created_at,
    }


# ── Категории + подкатегории ────────────────────────────────────────────────

@router.get("/categories")
def list_categories(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cats = db.query(ServiceCategory).order_by(ServiceCategory.sort_order, ServiceCategory.id).all()
    result = []
    for cat in cats:
        subcats = (
            db.query(ServiceSubcategory)
            .filter(ServiceSubcategory.category_id == cat.id)
            .order_by(ServiceSubcategory.sort_order, ServiceSubcategory.id)
            .all()
        )
        result.append({
            "id":         cat.id,
            "name":       cat.name,
            "sort_order": cat.sort_order,
            "subcategories": [
                {"id": s.id, "name": s.name, "category_id": s.category_id}
                for s in subcats
            ],
        })
    return result


# ── Позиции в подкатегории ──────────────────────────────────────────────────

@router.get("/subcategories/{subcat_id}/items")
def list_items(subcat_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    items = (
        db.query(ServiceItem)
        .filter(ServiceItem.subcategory_id == subcat_id)
        .order_by(ServiceItem.sort_order, ServiceItem.id)
        .all()
    )
    return [_item_dict(i) for i in items]


@router.post("/subcategories/{subcat_id}/items")
def create_item(
    subcat_id: int,
    data: ServiceItemIn,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    sub = db.query(ServiceSubcategory).filter(ServiceSubcategory.id == subcat_id).first()
    if not sub:
        raise HTTPException(404, "Подкатегория не найдена")
    item = ServiceItem(subcategory_id=subcat_id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_dict(item)


@router.put("/items/{item_id}")
def update_item(
    item_id: int,
    data: ServiceItemIn,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    item = db.query(ServiceItem).filter(ServiceItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Позиция не найдена")
    for k, v in data.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return _item_dict(item)


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(ServiceItem).filter(ServiceItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Позиция не найдена")
    db.delete(item)
    db.commit()
    return {"ok": True}
