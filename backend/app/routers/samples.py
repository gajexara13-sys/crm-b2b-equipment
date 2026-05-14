import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.price_position_indicator import PricePositionIndicator
from app.models.request import Request
from app.models.sample import Sample
from app.routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter()


class SampleIn(BaseModel):
    request_id: Optional[int] = None
    material_type: str
    material_name: Optional[str] = None
    material_grade: Optional[str] = None
    manufacturer: Optional[str] = None
    sampling_date: Optional[date] = None
    registration_date: Optional[date] = None
    sampling_location: Optional[str] = None
    sampled_by: Optional[str] = None
    sampling_conditions: Optional[str] = None
    act_type: str = "intake"
    material_norm_id: Optional[int] = None
    primary_nd_selected: Optional[List[str]] = None
    additional_nd_selected: Optional[List[str]] = None
    methodology_catalog_ids: Optional[List[int]] = None
    selected_price_position_ids: Optional[List[int]] = None
    selected_indicator_ids: Optional[List[int]] = None
    material_category_id: Optional[int] = None
    material_test_object_id: Optional[int] = None
    material_variant: Optional[str] = None


def _parse_json_int_list(raw: str | None) -> list[int]:
    if not raw:
        return []
    try:
        j = json.loads(raw)
        if not isinstance(j, list):
            return []
        return [int(x) for x in j]
    except Exception:
        return []


def _indicator_ids_from_price_positions(db: Session, price_position_ids: list[int]) -> list[int]:
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


def _sample_payload(data: SampleIn, db: Session) -> dict:
    d = data.dict()
    d["primary_nd_json"] = json.dumps(d.pop("primary_nd_selected") or [], ensure_ascii=False)
    d["additional_nd_json"] = json.dumps(d.pop("additional_nd_selected") or [], ensure_ascii=False)
    d["methodology_catalog_json"] = json.dumps(d.pop("methodology_catalog_ids") or [], ensure_ascii=False)
    price_pos_ids = d.pop("selected_price_position_ids", None) or []
    explicit_indicator_ids = d.pop("selected_indicator_ids", None) or []
    indicator_ids = explicit_indicator_ids or _indicator_ids_from_price_positions(db, price_pos_ids)
    d["selected_price_position_ids_json"] = json.dumps(price_pos_ids, ensure_ascii=False) if price_pos_ids else None
    d["selected_indicator_ids_json"] = json.dumps(indicator_ids, ensure_ascii=False) if indicator_ids else None
    return d


@router.get("")
def list_samples(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Sample).order_by(Sample.created_at.desc()).all()


@router.post("")
def create_sample(data: SampleIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    count = db.query(Sample).count()
    lab_number = f"ЛАБ-{date.today().year}-{count+1:04d}"
    payload = _sample_payload(data, db)
    s = Sample(**payload, lab_number=lab_number)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("/{id}")
def get_sample(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(Sample).filter(Sample.id == id).first()
    if not s:
        raise HTTPException(404, "Проба не найдена")
    return s


@router.put("/{id}")
def update_sample(id: int, data: SampleIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(Sample).filter(Sample.id == id).first()
    if not s:
        raise HTTPException(404, "Проба не найдена")
    payload = _sample_payload(data, db)
    for k, v in payload.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s
