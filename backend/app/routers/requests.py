from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.request import Request
from app.routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

router = APIRouter()

class RequestIn(BaseModel):
    client_id: int
    material_type: Optional[str] = None
    test_types: Optional[str] = None
    quantity: int = 1
    urgency: str = "normal"
    price: Optional[Decimal] = None
    status: str = "new"
    assigned_to: Optional[int] = None
    notes: Optional[str] = None

@router.get("/")
def list_requests(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Request).order_by(Request.created_at.desc()).all()

@router.post("/")
def create_request(data: RequestIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    count = db.query(Request).count()
    req = Request(**data.dict(), number=f"ЗАЯ-{2025}-{count+1:03d}")
    db.add(req); db.commit(); db.refresh(req)
    return req

@router.get("/{id}")
def get_request(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    r = db.query(Request).filter(Request.id == id).first()
    if not r: raise HTTPException(404, "Заявка не найдена")
    return r

@router.put("/{id}/status")
def update_status(id: int, status: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    r = db.query(Request).filter(Request.id == id).first()
    if not r: raise HTTPException(404, "Заявка не найдена")
    r.status = status; db.commit(); db.refresh(r)
    return r

@router.patch("/{id}/stage")
def update_stage(id: int, body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    r = db.query(Request).filter(Request.id == id).first()
    if not r: raise HTTPException(404, "Заявка не найдена")
    r.stage = body.get("stage", r.stage)
    db.commit(); db.refresh(r)
    return r
