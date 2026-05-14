from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.client import Client
from app.routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class ClientIn(BaseModel):
    name: str
    inn: Optional[str] = None
    kpp: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    contact_position: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None

@router.get("")
def list_clients(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Client).order_by(Client.name).all()

@router.post("")
def create_client(data: ClientIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = Client(**data.dict())
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.get("/{id}")
def get_client(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == id).first()
    if not c: raise HTTPException(404, "Клиент не найден")
    return c

@router.put("/{id}")
def update_client(id: int, data: ClientIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == id).first()
    if not c: raise HTTPException(404, "Клиент не найден")
    for k, v in data.dict().items(): setattr(c, k, v)
    db.commit(); db.refresh(c)
    return c

@router.delete("/{id}")
def delete_client(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == id).first()
    if not c: raise HTTPException(404, "Клиент не найден")
    db.delete(c); db.commit()
    return {"ok": True}
