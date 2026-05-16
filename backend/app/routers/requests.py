import json
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional, Any, List

from app.database import get_db
from app.models.deal_task import DealTask
from app.models.price_position import PricePosition
from app.models.price_position_indicator import PricePositionIndicator
from app.models.request import Request
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter()


class RequestIn(BaseModel):
    client_id: int
    contact_name: Optional[str] = None
    source: Optional[str] = None
    material_type: Optional[str] = None
    test_types: Optional[str] = None
    quantity: int = 1
    urgency: str = "normal"
    price: Optional[Decimal] = None
    status: str = "new"
    assigned_to: Optional[int] = None
    notes: Optional[str] = None
    material_category_id: Optional[int] = None
    material_test_object_id: Optional[int] = None
    material_variant: Optional[str] = None
    selected_price_position_ids: Optional[List[int]] = None
    selected_indicator_ids: Optional[List[int]] = None


class StageBody(BaseModel):
    stage: str


def _parse_json_int_list(raw: Optional[str]) -> List[int]:
    if not raw:
        return []
    try:
        j = json.loads(raw)
        if not isinstance(j, list):
            return []
        return [int(x) for x in j]
    except Exception:
        return []


def _indicator_ids_from_price_positions(db: Session, price_position_ids: List[int]) -> List[int]:
    if not price_position_ids:
        return []
    rows = (
        db.query(PricePositionIndicator)
        .filter(PricePositionIndicator.price_position_id.in_(price_position_ids))
        .order_by(PricePositionIndicator.sort_order, PricePositionIndicator.id)
        .all()
    )
    out: list[int] = []
    seen: set[int] = set()
    for r in rows:
        iid = int(r.test_indicator_id)
        if iid not in seen:
            seen.add(iid)
            out.append(iid)
    return out


def _price_positions_total(db: Session, ids: List[int]) -> Optional[Decimal]:
    if not ids:
        return None
    t = Decimal("0")
    for pid in ids:
        pp = db.query(PricePosition).filter(PricePosition.id == pid).first()
        if pp and pp.price_rub is not None:
            t += Decimal(str(float(pp.price_rub)))
    return t


def _enrich_request(r: Request) -> dict:
    d = {c.name: getattr(r, c.name) for c in Request.__table__.columns}
    d["selected_price_position_ids"] = _parse_json_int_list(getattr(r, "selected_price_position_ids_json", None))
    d["selected_indicator_ids"] = _parse_json_int_list(getattr(r, "selected_indicator_ids_json", None))
    return d


def _serialize_request_row(r: Request, next_due: Any) -> dict:
    d = _enrich_request(r)
    d["has_active_task"] = next_due is not None
    d["next_task_due_at"] = next_due
    return d


def _request_payload_from_in(data: RequestIn, db: Session) -> dict:
    d = data.dict()
    price_pos_ids = d.pop("selected_price_position_ids", None) or []
    explicit_indicator_ids = d.pop("selected_indicator_ids", None) or []

    indicator_ids = explicit_indicator_ids or _indicator_ids_from_price_positions(db, price_pos_ids)

    d["selected_price_position_ids_json"] = json.dumps(price_pos_ids, ensure_ascii=False) if price_pos_ids else None
    d["selected_indicator_ids_json"] = json.dumps(indicator_ids, ensure_ascii=False) if indicator_ids else None

    col_names = {c.name for c in Request.__table__.columns}
    clean = {k: v for k, v in d.items() if k in col_names}

    if price_pos_ids:
        tot = _price_positions_total(db, price_pos_ids)
        if tot is not None:
            clean["price"] = tot
    return clean


@router.get("")
def list_requests(db: Session = Depends(get_db), _=Depends(get_current_user)) -> List[dict]:
    sub = (
        db.query(
            DealTask.request_id.label("rid"),
            func.min(DealTask.due_at).label("next_due"),
        )
        .filter(DealTask.completed_at.is_(None))
        .filter(DealTask.due_at.isnot(None))
        .group_by(DealTask.request_id)
        .subquery()
    )
    rows = (
        db.query(Request, sub.c.next_due)
        .outerjoin(sub, Request.id == sub.c.rid)
        .order_by(Request.created_at.desc())
        .all()
    )
    return [_serialize_request_row(r, nd) for r, nd in rows]


@router.post("")
def create_request(data: RequestIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    count = db.query(Request).count()
    y = date.today().year
    payload = _request_payload_from_in(data, db)
    req = Request(number=f"ЗАЯ-{y}-{count+1:03d}", **payload)
    db.add(req)
    db.commit()
    db.refresh(req)
    return _enrich_request(req)


@router.get("/{id}")
def get_request(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    r = db.query(Request).filter(Request.id == id).first()
    if not r:
        raise HTTPException(404, "Заявка не найдена")
    return _enrich_request(r)


@router.put("/{id}")
def update_request(id: int, data: RequestIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    r = db.query(Request).filter(Request.id == id).first()
    if not r:
        raise HTTPException(404, "Заявка не найдена")
    payload = _request_payload_from_in(data, db)
    for k, v in payload.items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return _enrich_request(r)


@router.delete("/{id}")
def delete_request(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    r = db.query(Request).filter(Request.id == id).first()
    if not r:
        raise HTTPException(404, "Заявка не найдена")
    db.query(DealTask).filter(DealTask.request_id == id).delete()
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.put("/{id}/status")
def update_status(id: int, status: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    r = db.query(Request).filter(Request.id == id).first()
    if not r:
        raise HTTPException(404, "Заявка не найдена")
    r.status = status
    db.commit()
    db.refresh(r)
    return r


@router.patch("/{id}/stage")
def update_stage(
    id: int,
    body: StageBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Request).filter(Request.id == id).first()
    if not r:
        raise HTTPException(404, "Заявка не найдена")
    old = r.stage or "new_request"
    new = body.stage
    if new != old and user.role in ("manager", "sales"):
        has_open = (
            db.query(DealTask)
            .filter(
                DealTask.request_id == id,
                DealTask.completed_at.is_(None),
                DealTask.due_at.isnot(None),
            )
            .first()
        )
        if not has_open:
            raise HTTPException(
                400,
                "Перед сменой этапа создайте задачу на следующий шаг с дедлайном "
                "(звонок, отправка КП, встреча, контроль оплаты).",
            )
    r.stage = new
    db.commit()
    db.refresh(r)
    out = _serialize_request_row(
        r,
        db.query(func.min(DealTask.due_at))
        .filter(
            DealTask.request_id == id,
            DealTask.completed_at.is_(None),
            DealTask.due_at.isnot(None),
        )
        .scalar(),
    )
    return out
