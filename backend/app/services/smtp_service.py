"""Отправка писем через SMTP (Яндекс 360 или любой другой провайдер)."""
from __future__ import annotations

import json
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.email_message import EmailMessage
from app.models.email_settings import EmailSettings


def _get_settings(db: Session) -> Optional[EmailSettings]:
    return db.query(EmailSettings).filter(EmailSettings.id == 1).first()


def send_email(
    db: Session,
    to_emails: List[str],
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    cc_emails: Optional[List[str]] = None,
    reply_to: Optional[str] = None,
    linked_request_id: Optional[int] = None,
    linked_client_id: Optional[int] = None,
) -> EmailMessage:
    """Отправляет письмо через SMTP и сохраняет запись в БД."""
    cfg = _get_settings(db)
    if not cfg or not cfg.smtp_username or not cfg.smtp_password:
        raise ValueError("SMTP не настроен. Заполните настройки в Справочнике → Настройки почты.")

    from_addr = cfg.from_email or cfg.smtp_username
    from_display = formataddr((cfg.from_name or "CRM", from_addr))
    msg_id = make_msgid(domain=from_addr.split("@")[-1] if "@" in from_addr else "crm")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_display
    msg["To"] = ", ".join(to_emails)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = msg_id
    if cc_emails:
        msg["Cc"] = ", ".join(cc_emails)
    if reply_to:
        msg["Reply-To"] = reply_to

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    all_recipients = to_emails + (cc_emails or [])

    context = ssl.create_default_context()
    if cfg.smtp_use_tls:
        with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=30) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(cfg.smtp_username, cfg.smtp_password)
            server.sendmail(from_addr, all_recipients, msg.as_string())
    else:
        with smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, context=context, timeout=30) as server:
            server.login(cfg.smtp_username, cfg.smtp_password)
            server.sendmail(from_addr, all_recipients, msg.as_string())

    record = EmailMessage(
        message_id_hdr=msg_id,
        thread_id=msg_id,
        direction="out",
        from_email=from_addr,
        from_name=cfg.from_name,
        to_email=json.dumps(to_emails, ensure_ascii=False),
        cc_email=json.dumps(cc_emails, ensure_ascii=False) if cc_emails else None,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        is_read=True,
        linked_request_id=linked_request_id,
        linked_client_id=linked_client_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def test_smtp(cfg: EmailSettings) -> dict:
    """Проверяет SMTP-подключение без отправки письма."""
    try:
        context = ssl.create_default_context()
        if cfg.smtp_use_tls:
            with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=10) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(cfg.smtp_username, cfg.smtp_password)
        else:
            with smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, context=context, timeout=10) as server:
                server.login(cfg.smtp_username, cfg.smtp_password)
        return {"ok": True, "message": "SMTP подключение успешно"}
    except Exception as e:
        return {"ok": False, "message": str(e)}
