from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.company import Company
from app.models.contact import Contact
from app.routers.auth import get_current_user

router = APIRouter()


class CompanyIn(BaseModel):
    name: str
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    segment: Optional[str] = None
    source_default: Optional[str] = None
    notes: Optional[str] = None


class ContactIn(BaseModel):
    company_id: int
    full_name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False


@router.get("/companies")
def list_companies(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Company).order_by(Company.name).all()


@router.post("/companies")
def create_company(data: CompanyIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if data.inn:
        exists = db.query(Company).filter(Company.inn == data.inn).first()
        if exists:
            raise HTTPException(400, "Компания с таким ИНН уже есть")
    c = Company(**data.dict())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/companies/{id}")
def get_company(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Company).filter(Company.id == id).first()
    if not c:
        raise HTTPException(404, "Компания не найдена")
    return c


@router.put("/companies/{id}")
def update_company(id: int, data: CompanyIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Company).filter(Company.id == id).first()
    if not c:
        raise HTTPException(404, "Компания не найдена")
    if data.inn:
        exists = db.query(Company).filter(Company.inn == data.inn, Company.id != id).first()
        if exists:
            raise HTTPException(400, "Компания с таким ИНН уже есть")
    for k, v in data.dict().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/companies/{id}")
def delete_company(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Company).filter(Company.id == id).first()
    if not c:
        raise HTTPException(404, "Компания не найдена")
    db.query(Contact).filter(Contact.company_id == id).delete()
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.get("/contacts")
def list_contacts(company_id: Optional[int] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Contact)
    if company_id:
        q = q.filter(Contact.company_id == company_id)
    return q.order_by(Contact.id.desc()).all()


@router.post("/contacts")
def create_contact(data: ContactIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        raise HTTPException(404, "Компания не найдена")
    if data.is_primary:
        db.query(Contact).filter(Contact.company_id == data.company_id).update({"is_primary": False})
    contact = Contact(**data.dict())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/contacts/{id}")
def update_contact(id: int, data: ContactIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Contact).filter(Contact.id == id).first()
    if not c:
        raise HTTPException(404, "Контакт не найден")
    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        raise HTTPException(404, "Компания не найдена")
    if data.is_primary:
        db.query(Contact).filter(Contact.company_id == data.company_id).update({"is_primary": False})
    for k, v in data.dict().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/contacts/{id}")
def delete_contact(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Contact).filter(Contact.id == id).first()
    if not c:
        raise HTTPException(404, "Контакт не найден")
    db.delete(c)
    db.commit()
    return {"ok": True}
