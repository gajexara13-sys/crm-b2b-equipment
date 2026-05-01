from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.protocol import Protocol
from app.routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()

class ProtocolIn(BaseModel):
    sample_id: int
    test_id: int
    conclusion: Optional[str] = None
    notes: Optional[str] = None

@router.get("/")
def list_protocols(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Protocol).order_by(Protocol.number.desc()).all()

@router.post("/")
def create_protocol(data: ProtocolIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    last = db.query(Protocol).order_by(Protocol.number.desc()).first()
    number = (last.number + 1) if last else 1
    p = Protocol(**data.dict(), number=number, laborant_id=user.id, status="draft")
    db.add(p); db.commit(); db.refresh(p)
    return p

@router.put("/{id}/sign")
def sign_protocol(id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role not in ("lab_head", "admin"):
        raise HTTPException(403, "Только начальник лаборатории может подписывать протоколы")
    p = db.query(Protocol).filter(Protocol.id == id).first()
    if not p: raise HTTPException(404, "Протокол не найден")
    p.status = "signed"; p.lab_head_id = user.id; p.signed_at = datetime.utcnow()
    db.commit(); db.refresh(p)
    return p

@router.put("/{id}/status")
def update_status(id: int, status: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Protocol).filter(Protocol.id == id).first()
    if not p: raise HTTPException(404, "Протокол не найден")
    p.status = status; db.commit(); db.refresh(p)
    return p

@router.get("/{id}")
def get_protocol(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Protocol).filter(Protocol.id == id).first()
    if not p: raise HTTPException(404, "Протокол не найден")
    return p
