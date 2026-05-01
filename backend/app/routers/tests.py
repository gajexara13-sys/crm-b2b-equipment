from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.test import Test
from app.routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, Any
from datetime import date

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

@router.get("/")
def list_tests(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Test).order_by(Test.created_at.desc()).all()

@router.post("/")
def create_test(data: TestIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = Test(**data.dict(), laborant_id=user.id, status="draft")
    db.add(t); db.commit(); db.refresh(t)
    return t

@router.get("/{id}")
def get_test(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Test).filter(Test.id == id).first()
    if not t: raise HTTPException(404, "Карточка не найдена")
    return t

@router.put("/{id}")
def update_test(id: int, data: TestIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Test).filter(Test.id == id).first()
    if not t: raise HTTPException(404, "Карточка не найдена")
    for k, v in data.dict().items(): setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t
