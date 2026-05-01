from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.sample import Sample
from app.routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
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

@router.get("/")
def list_samples(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Sample).order_by(Sample.created_at.desc()).all()

@router.post("/")
def create_sample(data: SampleIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    count = db.query(Sample).count()
    lab_number = f"ЛАБ-{date.today().year}-{count+1:04d}"
    s = Sample(**data.dict(), lab_number=lab_number)
    db.add(s); db.commit(); db.refresh(s)
    return s

@router.get("/{id}")
def get_sample(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(Sample).filter(Sample.id == id).first()
    if not s: raise HTTPException(404, "Проба не найдена")
    return s

@router.put("/{id}")
def update_sample(id: int, data: SampleIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(Sample).filter(Sample.id == id).first()
    if not s: raise HTTPException(404, "Проба не найдена")
    for k, v in data.dict().items(): setattr(s, k, v)
    db.commit(); db.refresh(s)
    return s
