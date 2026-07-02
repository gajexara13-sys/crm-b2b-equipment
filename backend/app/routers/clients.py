import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.client import Client
from app.routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()


class ExtraContact(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class ClientIn(BaseModel):
    name: str
    inn: Optional[str] = None
    kpp: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    contact_position: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact2_name: Optional[str] = None
    contact2_position: Optional[str] = None
    contact2_phone: Optional[str] = None
    contact2_email: Optional[str] = None
    extra_contacts: Optional[List[ExtraContact]] = None
    notes: Optional[str] = None


def _client_out(c: Client) -> dict:
    d = {col.name: getattr(c, col.name) for col in Client.__table__.columns}
    raw = d.pop("extra_contacts_json", None)
    try:
        d["extra_contacts"] = json.loads(raw) if raw else []
    except Exception:
        d["extra_contacts"] = []
    return d


def _apply(data: ClientIn, c: Client) -> None:
    payload = data.dict()
    extra = payload.pop("extra_contacts", None)
    for k, v in payload.items():
        setattr(c, k, v)
    if extra is not None:
        cleaned = [e for e in extra if any((e or {}).values())]
        c.extra_contacts_json = json.dumps(cleaned, ensure_ascii=False) if cleaned else None


@router.get("")
def list_clients(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_client_out(c) for c in db.query(Client).order_by(Client.name).all()]


@router.post("")
def create_client(data: ClientIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = Client()
    _apply(data, c)
    db.add(c); db.commit(); db.refresh(c)
    return _client_out(c)


@router.get("/{id}")
def get_client(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == id).first()
    if not c: raise HTTPException(404, "Клиент не найден")
    return _client_out(c)


@router.put("/{id}")
def update_client(id: int, data: ClientIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == id).first()
    if not c: raise HTTPException(404, "Клиент не найден")
    _apply(data, c)
    db.commit(); db.refresh(c)
    return _client_out(c)


@router.delete("/{id}")
def delete_client(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == id).first()
    if not c: raise HTTPException(404, "Клиент не найден")
    db.delete(c); db.commit()
    return {"ok": True}
