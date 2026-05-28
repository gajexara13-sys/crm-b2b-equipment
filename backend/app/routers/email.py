"""REST API для почтового модуля."""
from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.email_message import EmailMessage
from app.models.email_settings import EmailSettings
from app.routers.auth import get_current_user
from app.services import smtp_service, imap_service

router = APIRouter()


# ──────────────────── Схемы ────────────────────

class SendEmailRequest(BaseModel):
    to_emails: List[str]
    subject: str
    body_text: str
    body_html: Optional[str] = None
    cc_emails: Optional[List[str]] = None
    reply_to: Optional[str] = None
    linked_request_id: Optional[int] = None
    linked_client_id: Optional[int] = None


class LinkMessageRequest(BaseModel):
    linked_request_id: Optional[int] = None
    linked_client_id: Optional[int] = None


class EmailSettingsSchema(BaseModel):
    smtp_host: str = "smtp.yandex.ru"
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    from_name: str = "CRM RUTEST"
    from_email: Optional[str] = None
    imap_host: str = "imap.yandex.ru"
    imap_port: int = 993
    imap_use_ssl: bool = True
    imap_username: Optional[str] = None
    imap_password: Optional[str] = None
    imap_folder: str = "INBOX"
    sync_interval_min: int = 5
    is_enabled: bool = False

    class Config:
        from_attributes = True


def _msg_to_dict(m: EmailMessage) -> dict:
    return {
        "id": m.id,
        "message_uid": m.message_uid,
        "thread_id": m.thread_id,
        "direction": m.direction,
        "from_email": m.from_email,
        "from_name": m.from_name,
        "to_email": m.to_email,
        "subject": m.subject,
        "body_text": m.body_text,
        "body_html": m.body_html,
        "attachments": json.loads(m.attachments_json) if m.attachments_json else [],
        "sent_at": m.sent_at.isoformat() if m.sent_at else None,
        "received_at": m.received_at.isoformat() if m.received_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "is_read": m.is_read,
        "linked_request_id": m.linked_request_id,
        "linked_client_id": m.linked_client_id,
    }


# ──────────────────── Эндпоинты ────────────────────

@router.get("/messages")
def list_messages(
    direction: Optional[str] = Query(None, description="in | out"),
    is_read: Optional[bool] = Query(None),
    client_id: Optional[int] = Query(None),
    request_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(EmailMessage).filter(EmailMessage.is_deleted == False)  # noqa
    if direction:
        q = q.filter(EmailMessage.direction == direction)
    if is_read is not None:
        q = q.filter(EmailMessage.is_read == is_read)
    if client_id is not None:
        q = q.filter(EmailMessage.linked_client_id == client_id)
    if request_id is not None:
        q = q.filter(EmailMessage.linked_request_id == request_id)
    if search:
        like = f"%{search}%"
        q = q.filter(
            EmailMessage.subject.ilike(like) |
            EmailMessage.from_email.ilike(like) |
            EmailMessage.body_text.ilike(like)
        )
    total = q.count()
    items = q.order_by(EmailMessage.id.desc()).offset(offset).limit(limit).all()
    return {"total": total, "items": [_msg_to_dict(m) for m in items]}


@router.get("/thread/{thread_id}")
def get_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    messages = (
        db.query(EmailMessage)
        .filter(EmailMessage.thread_id == thread_id, EmailMessage.is_deleted == False)  # noqa
        .order_by(EmailMessage.id.asc())
        .all()
    )
    return [_msg_to_dict(m) for m in messages]


@router.post("/send")
def send_email_endpoint(
    payload: SendEmailRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        record = smtp_service.send_email(
            db=db,
            to_emails=payload.to_emails,
            subject=payload.subject,
            body_text=payload.body_text,
            body_html=payload.body_html,
            cc_emails=payload.cc_emails,
            reply_to=payload.reply_to,
            linked_request_id=payload.linked_request_id,
            linked_client_id=payload.linked_client_id,
        )
        return _msg_to_dict(record)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка отправки: {e}")


@router.post("/sync")
def sync_email(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = imap_service.sync_inbox(db)
    return result


@router.put("/messages/{msg_id}/read")
def mark_read(
    msg_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    m = db.query(EmailMessage).filter(EmailMessage.id == msg_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Письмо не найдено")
    m.is_read = True
    db.commit()
    return {"ok": True}


@router.put("/messages/{msg_id}/link")
def link_message(
    msg_id: int,
    payload: LinkMessageRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    m = db.query(EmailMessage).filter(EmailMessage.id == msg_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Письмо не найдено")
    m.linked_request_id = payload.linked_request_id
    m.linked_client_id = payload.linked_client_id
    db.commit()
    return _msg_to_dict(m)


@router.delete("/messages/{msg_id}")
def delete_message(
    msg_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    m = db.query(EmailMessage).filter(EmailMessage.id == msg_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Письмо не найдено")
    m.is_deleted = True
    db.commit()
    return {"ok": True}


@router.get("/settings", response_model=EmailSettingsSchema)
def get_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cfg = db.query(EmailSettings).filter(EmailSettings.id == 1).first()
    if not cfg:
        cfg = EmailSettings(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    result = EmailSettingsSchema.model_validate(cfg)
    # Скрываем пароль в ответе
    result.smtp_password = "***" if cfg.smtp_password else None
    result.imap_password = "***" if cfg.imap_password else None
    return result


@router.put("/settings")
def update_settings(
    payload: EmailSettingsSchema,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cfg = db.query(EmailSettings).filter(EmailSettings.id == 1).first()
    if not cfg:
        cfg = EmailSettings(id=1)
        db.add(cfg)

    cfg.smtp_host = payload.smtp_host
    cfg.smtp_port = payload.smtp_port
    cfg.smtp_use_tls = payload.smtp_use_tls
    cfg.smtp_username = payload.smtp_username
    if payload.smtp_password and payload.smtp_password != "***":
        cfg.smtp_password = payload.smtp_password
    cfg.from_name = payload.from_name
    cfg.from_email = payload.from_email

    cfg.imap_host = payload.imap_host
    cfg.imap_port = payload.imap_port
    cfg.imap_use_ssl = payload.imap_use_ssl
    cfg.imap_username = payload.imap_username
    if payload.imap_password and payload.imap_password != "***":
        cfg.imap_password = payload.imap_password
    cfg.imap_folder = payload.imap_folder
    cfg.sync_interval_min = payload.sync_interval_min
    cfg.is_enabled = payload.is_enabled

    db.commit()
    return {"ok": True, "message": "Настройки сохранены"}


@router.post("/settings/test")
def test_connection(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cfg = db.query(EmailSettings).filter(EmailSettings.id == 1).first()
    if not cfg:
        raise HTTPException(status_code=400, detail="Настройки не заданы")

    smtp_result = smtp_service.test_smtp(cfg)
    imap_result = imap_service.test_imap(cfg)

    return {
        "smtp": smtp_result,
        "imap": imap_result,
    }
