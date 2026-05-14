from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.deal_item import DealItem
from app.models.product import Product
from app.models.quote import Quote
from app.routers.auth import get_current_user

router = APIRouter()


class DealIn(BaseModel):
    company_id: int
    contact_id: Optional[int] = None
    name: str
    source: str
    category_code: Optional[str] = None
    stage: str = "new_lead"
    probability: int = 10
    next_step: str
    next_step_date: date
    deadline: Optional[date] = None
    status: str = "open"
    loss_reason: Optional[str] = None
    notes: Optional[str] = None


class DealItemIn(BaseModel):
    product_id: int
    qty: float = 1
    unit_price: Optional[float] = None
    discount_pct: float = 0


def _recalc_deal_totals(db: Session, deal_id: int) -> None:
    items = db.query(DealItem).filter(DealItem.deal_id == deal_id).all()
    amount = 0.0
    total_margin = 0.0
    for item in items:
        amount += float(item.line_total or 0)
        total_margin += float(item.line_margin or 0)
    margin_pct = (total_margin / amount * 100) if amount > 0 else 0
    d = db.query(Deal).filter(Deal.id == deal_id).first()
    if d:
        d.amount = round(amount, 2)
        d.gross_margin = round(total_margin, 2)
        d.margin_pct = round(margin_pct, 2)


@router.get("")
def list_deals(
    stage: Optional[str] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Deal)
    if stage:
        q = q.filter(Deal.stage == stage)
    if source:
        q = q.filter(Deal.source == source)
    return q.order_by(Deal.created_at.desc()).all()


@router.post("")
def create_deal(data: DealIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        raise HTTPException(404, "Компания не найдена")
    if data.contact_id is not None:
        contact = db.query(Contact).filter(Contact.id == data.contact_id).first()
        if not contact:
            raise HTTPException(404, "Контакт не найден")
    deal = Deal(**data.dict())
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return deal


@router.get("/{id}")
def get_deal(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    d = db.query(Deal).filter(Deal.id == id).first()
    if not d:
        raise HTTPException(404, "Сделка не найдена")
    items = db.query(DealItem).filter(DealItem.deal_id == id).all()
    quotes = db.query(Quote).filter(Quote.deal_id == id).order_by(Quote.version.desc()).all()
    return {"deal": d, "items": items, "quotes": quotes}


@router.put("/{id}")
def update_deal(id: int, data: DealIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    d = db.query(Deal).filter(Deal.id == id).first()
    if not d:
        raise HTTPException(404, "Сделка не найдена")
    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        raise HTTPException(404, "Компания не найдена")
    if data.contact_id is not None:
        contact = db.query(Contact).filter(Contact.id == data.contact_id).first()
        if not contact:
            raise HTTPException(404, "Контакт не найден")
    for k, v in data.dict().items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


@router.delete("/{id}")
def delete_deal(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    d = db.query(Deal).filter(Deal.id == id).first()
    if not d:
        raise HTTPException(404, "Сделка не найдена")
    db.query(DealItem).filter(DealItem.deal_id == id).delete()
    db.query(Quote).filter(Quote.deal_id == id).delete()
    db.delete(d)
    db.commit()
    return {"ok": True}


@router.post("/{id}/items")
def add_item(id: int, data: DealItemIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    d = db.query(Deal).filter(Deal.id == id).first()
    if not d:
        raise HTTPException(404, "Сделка не найдена")
    p = db.query(Product).filter(Product.id == data.product_id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")

    legacy_cost = float(p.purchase_cost or 0) + float(p.logistics_cost or 0) + float(p.extra_cost or 0)
    full_cost = float(p.cost_with_vat or 0) if legacy_cost <= 0 else legacy_cost
    if data.unit_price is not None:
        unit_price = float(data.unit_price)
    else:
        unit_price = float(
            (p.price_end_vat or 0)
            or (p.recommended_price or 0)
            or (p.price_dealers_vat or 0)
            or 0
        )
    qty = float(data.qty or 0)
    discount_pct = float(data.discount_pct or 0)
    final_unit_price = unit_price * (1 - discount_pct / 100)
    line_total = final_unit_price * qty
    line_margin = (final_unit_price - full_cost) * qty
    line_margin_pct = (line_margin / line_total * 100) if line_total > 0 else 0

    item = DealItem(
        deal_id=id,
        product_id=data.product_id,
        qty=qty,
        unit_cost=round(full_cost, 2),
        unit_price=round(unit_price, 2),
        discount_pct=round(discount_pct, 2),
        line_total=round(line_total, 2),
        line_margin=round(line_margin, 2),
        line_margin_pct=round(line_margin_pct, 2),
    )
    db.add(item)
    _recalc_deal_totals(db, id)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{id}/items/{item_id}")
def delete_item(id: int, item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    d = db.query(Deal).filter(Deal.id == id).first()
    if not d:
        raise HTTPException(404, "Сделка не найдена")
    item = db.query(DealItem).filter(DealItem.id == item_id, DealItem.deal_id == id).first()
    if not item:
        raise HTTPException(404, "Позиция не найдена")
    db.delete(item)
    _recalc_deal_totals(db, id)
    db.commit()
    return {"ok": True}


@router.post("/{id}/quote")
def create_quote(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    d = db.query(Deal).filter(Deal.id == id).first()
    if not d:
        raise HTTPException(404, "Сделка не найдена")
    last = db.query(Quote).filter(Quote.deal_id == id).order_by(Quote.version.desc()).first()
    version = (last.version + 1) if last else 1
    number = f"КП-{date.today().year}-{id:04d}-v{version}"
    q = Quote(
        deal_id=id,
        number=number,
        version=version,
        status="draft",
        total=round(float(d.amount or 0), 2),
        margin_pct=round(float(d.margin_pct or 0), 2),
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q
