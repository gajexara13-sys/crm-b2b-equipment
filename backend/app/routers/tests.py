from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Any, Optional

from app.database import get_db
from app.models.sample import Sample
from app.models.test import Test
from app.routers.auth import get_current_user

router = APIRouter()


class TestIn(BaseModel):
    sample_id: int
    test_type: str
    material_type: Optional[str] = None
    material_grade: Optional[str] = None
    gost: Optional[str] = None
    grain_composition: Optional[Any] = None
    binder_content: Optional[Any] = None
    max_density: Optional[Any] = None
    bulk_density: Optional[Any] = None
    air_voids: Optional[Any] = None
    water_resistance: Optional[Any] = None
    dust_clay: Optional[Any] = None
    notes: Optional[str] = None
    tested_at: Optional[date] = None
    status: Optional[str] = "draft"


class TestRead(BaseModel):
    """Ответ API — явная схема, чтобы не ловить 500 при сериализации ORM."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    sample_id: Optional[int] = None
    test_type: Optional[str] = None
    laborant_id: Optional[int] = None
    status: Optional[str] = None
    material_type: Optional[str] = None
    material_grade: Optional[str] = None
    gost: Optional[str] = None
    grain_composition: Optional[Any] = None
    binder_content: Optional[Any] = None
    max_density: Optional[Any] = None
    bulk_density: Optional[Any] = None
    air_voids: Optional[Any] = None
    water_resistance: Optional[Any] = None
    dust_clay: Optional[Any] = None
    notes: Optional[str] = None
    tested_at: Optional[date] = None
    created_at: Optional[datetime] = None


def _ensure_sample(db: Session, sample_id: int) -> None:
    if db.query(Sample.id).filter(Sample.id == sample_id).first() is None:
        raise HTTPException(
            status_code=400,
            detail="Проба не найдена. Выберите пробу в списке перед сохранением карточки.",
        )


@router.get("", response_model=list[TestRead])
def list_tests(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.query(Test).order_by(Test.created_at.desc()).all()
    return [TestRead.model_validate(r) for r in rows]


@router.post("", response_model=TestRead)
def create_test(data: TestIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    payload = data.model_dump()
    _ensure_sample(db, payload["sample_id"])
    status_val = payload.pop("status", None) or "draft"
    t = Test(**payload, laborant_id=user.id, status=status_val)
    db.add(t)
    try:
        db.commit()
        db.refresh(t)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Не удалось сохранить карточку (проверьте номер пробы): {e.orig!s}",
        ) from e
    return TestRead.model_validate(t)


@router.get("/{id}", response_model=TestRead)
def get_test(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Test).filter(Test.id == id).first()
    if not t:
        raise HTTPException(404, "Карточка не найдена")
    return TestRead.model_validate(t)


@router.put("/{id}", response_model=TestRead)
def update_test(id: int, data: TestIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Test).filter(Test.id == id).first()
    if not t:
        raise HTTPException(404, "Карточка не найдена")
    payload = data.model_dump()
    _ensure_sample(db, payload["sample_id"])
    status_val = payload.pop("status", None)
    for k, v in payload.items():
        setattr(t, k, v)
    if status_val is not None:
        t.status = status_val
    try:
        db.commit()
        db.refresh(t)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Ошибка сохранения: {e.orig!s}") from e
    return TestRead.model_validate(t)


@router.delete("/{id}")
def delete_test(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    from app.models.protocol import Protocol
    t = db.query(Test).filter(Test.id == id).first()
    if not t:
        raise HTTPException(404, "Карточка не найдена")
    db.query(Protocol).filter(Protocol.test_id == id).delete()
    db.delete(t)
    db.commit()
    return {"ok": True}
