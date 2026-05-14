import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.material_category import MaterialCategory
from app.models.material_test_object import MaterialTestObject
from app.models.price_list_entry import PriceListEntry
from app.models.price_position import PricePosition
from app.models.price_position_indicator import PricePositionIndicator
from app.models.test_indicator import TestIndicator
from app.reference_sync import sync_reference_from_legacy
from app.routers.auth import get_current_user

router = APIRouter()


class IndicatorOut(BaseModel):
    id: int
    test_object_id: int
    characteristic: str
    range_text: str | None
    standard_ref: str | None
    price_code: str | None
    price_rub: float | None

    class Config:
        from_attributes = True


class CalculateIn(BaseModel):
    indicator_ids: list[int]


class PricePatch(BaseModel):
    price_code: str | None = None
    price_rub: float | None = None


@router.get("/categories")
def list_categories(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(MaterialCategory).order_by(MaterialCategory.sort_order, MaterialCategory.id).all()


@router.get("/test-objects")
def list_test_objects(
    category_id: int = Query(..., description="ID категории"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return (
        db.query(MaterialTestObject)
        .filter(MaterialTestObject.category_id == category_id)
        .order_by(MaterialTestObject.sort_order, MaterialTestObject.id)
        .all()
    )


@router.get("/indicators", response_model=list[IndicatorOut])
def list_indicators(
    test_object_id: int = Query(..., description="ID объекта испытаний"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    rows = (
        db.query(TestIndicator, PriceListEntry)
        .outerjoin(PriceListEntry, PriceListEntry.test_indicator_id == TestIndicator.id)
        .filter(TestIndicator.test_object_id == test_object_id)
        .order_by(TestIndicator.sort_order, TestIndicator.id)
        .all()
    )
    out: list[IndicatorOut] = []
    for ti, pe in rows:
        out.append(
            IndicatorOut(
                id=ti.id,
                test_object_id=ti.test_object_id,
                characteristic=ti.characteristic,
                range_text=ti.range_text,
                standard_ref=ti.standard_ref,
                price_code=pe.price_code if pe else None,
                price_rub=float(pe.price_rub) if pe and pe.price_rub is not None else None,
            )
        )
    return out


@router.post("/sync-from-legacy")
def post_sync_from_legacy(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Пересобрать справочник из material_norms + catalog_items (очищает справочные таблицы)."""
    try:
        stats = sync_reference_from_legacy(db)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e)) from e
    return stats


@router.post("/calculate-total")
def post_calculate_total(data: CalculateIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    total = Decimal("0")
    lines: list[dict] = []
    for iid in data.indicator_ids:
        ti = db.query(TestIndicator).filter(TestIndicator.id == iid).first()
        pe = db.query(PriceListEntry).filter(PriceListEntry.test_indicator_id == iid).first()
        amt = float(pe.price_rub) if pe and pe.price_rub is not None else 0.0
        total += Decimal(str(amt))
        lines.append(
            {
                "indicator_id": iid,
                "characteristic": ti.characteristic if ti else None,
                "price_code": pe.price_code if pe else None,
                "price_rub": amt,
            }
        )
    return {"total_rub": float(total), "lines": lines}


@router.patch("/indicators/{indicator_id}/price")
def patch_indicator_price(
    indicator_id: int,
    data: PricePatch,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    ti = db.query(TestIndicator).filter(TestIndicator.id == indicator_id).first()
    if not ti:
        raise HTTPException(404, "Показатель не найден")
    pe = db.query(PriceListEntry).filter(PriceListEntry.test_indicator_id == indicator_id).first()
    if not pe:
        pe = PriceListEntry(test_indicator_id=indicator_id, price_code="", price_rub=None)
        db.add(pe)
    if data.price_code is not None:
        pe.price_code = data.price_code
    if data.price_rub is not None:
        pe.price_rub = float(data.price_rub) if data.price_rub >= 0 else None
    db.commit()
    db.refresh(pe)
    return {"ok": True, "price_code": pe.price_code, "price_rub": pe.price_rub}

class PricePositionOut(BaseModel):
    id: int
    test_object_id: int | None
    price_code: str
    display_name: str | None
    price_rub: float | None
    linked_indicator_ids: list[int]


class PricePositionIn(BaseModel):
    test_object_id: int | None = None
    price_code: str
    display_name: str | None = None
    price_rub: float | None = None


class PricePositionPatch(BaseModel):
    price_code: str | None = None
    display_name: str | None = None
    price_rub: float | None = None


class PricePositionLinksIn(BaseModel):
    indicator_ids: list[int]


class CalculateByPriceIn(BaseModel):
    price_position_ids: list[int]


def _linked_indicator_ids(db: Session, price_position_id: int) -> list[int]:
    rows = (
        db.query(PricePositionIndicator)
        .filter(PricePositionIndicator.price_position_id == price_position_id)
        .order_by(PricePositionIndicator.sort_order, PricePositionIndicator.id)
        .all()
    )
    return [int(r.test_indicator_id) for r in rows]


@router.get("/price-positions", response_model=list[PricePositionOut])
def list_price_positions(
    test_object_id: int | None = Query(None, description="ID объекта испытаний"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(PricePosition)
    if test_object_id is not None:
        q = q.filter(PricePosition.test_object_id == test_object_id)
    rows = q.order_by(PricePosition.sort_order, PricePosition.id).all()
    return [
        PricePositionOut(
            id=r.id,
            test_object_id=r.test_object_id,
            price_code=r.price_code,
            display_name=r.display_name,
            price_rub=float(r.price_rub) if r.price_rub is not None else None,
            linked_indicator_ids=_linked_indicator_ids(db, r.id),
        )
        for r in rows
    ]


@router.post("/price-positions", response_model=PricePositionOut)
def create_price_position(data: PricePositionIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    pp = PricePosition(
        test_object_id=data.test_object_id,
        price_code=data.price_code.strip(),
        display_name=data.display_name,
        price_rub=float(data.price_rub) if data.price_rub is not None else None,
        sort_order=db.query(PricePosition).count(),
    )
    db.add(pp)
    db.commit()
    db.refresh(pp)
    return PricePositionOut(
        id=pp.id,
        test_object_id=pp.test_object_id,
        price_code=pp.price_code,
        display_name=pp.display_name,
        price_rub=float(pp.price_rub) if pp.price_rub is not None else None,
        linked_indicator_ids=[],
    )


@router.patch("/price-positions/{position_id}", response_model=PricePositionOut)
def patch_price_position(position_id: int, data: PricePositionPatch, db: Session = Depends(get_db), _=Depends(get_current_user)):
    pp = db.query(PricePosition).filter(PricePosition.id == position_id).first()
    if not pp:
        raise HTTPException(404, "Позиция прайса не найдена")
    if data.price_code is not None:
        pp.price_code = data.price_code
    if data.display_name is not None:
        pp.display_name = data.display_name
    if data.price_rub is not None:
        pp.price_rub = float(data.price_rub) if data.price_rub >= 0 else None
    db.commit()
    db.refresh(pp)
    return PricePositionOut(
        id=pp.id,
        test_object_id=pp.test_object_id,
        price_code=pp.price_code,
        display_name=pp.display_name,
        price_rub=float(pp.price_rub) if pp.price_rub is not None else None,
        linked_indicator_ids=_linked_indicator_ids(db, pp.id),
    )


@router.post("/price-positions/{position_id}/link-indicators")
def link_price_position_indicators(position_id: int, data: PricePositionLinksIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    pp = db.query(PricePosition).filter(PricePosition.id == position_id).first()
    if not pp:
        raise HTTPException(404, "Позиция прайса не найдена")
    db.query(PricePositionIndicator).filter(PricePositionIndicator.price_position_id == position_id).delete()
    for i, iid in enumerate(data.indicator_ids):
        db.add(PricePositionIndicator(price_position_id=position_id, test_indicator_id=iid, sort_order=i))
    db.commit()
    return {"ok": True, "linked_indicator_ids": _linked_indicator_ids(db, position_id)}


@router.post("/calculate-total-by-price")
def post_calculate_total_by_price(data: CalculateByPriceIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    total = Decimal("0")
    lines: list[dict] = []
    for pid in data.price_position_ids:
        pp = db.query(PricePosition).filter(PricePosition.id == pid).first()
        amt = float(pp.price_rub) if pp and pp.price_rub is not None else 0.0
        total += Decimal(str(amt))
        lines.append(
            {
                "price_position_id": pid,
                "price_code": pp.price_code if pp else None,
                "display_name": pp.display_name if pp else None,
                "price_rub": amt,
                "indicator_ids": _linked_indicator_ids(db, pid) if pp else [],
            }
        )
    return {"total_rub": float(total), "lines": lines}


@router.post("/indicators-by-price-positions")
def post_indicators_by_price_positions(data: CalculateByPriceIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    seen: set[int] = set()
    out: list[int] = []
    for pid in data.price_position_ids:
        for iid in _linked_indicator_ids(db, pid):
            if iid not in seen:
                seen.add(iid)
                out.append(iid)
    return {"indicator_ids": out}
