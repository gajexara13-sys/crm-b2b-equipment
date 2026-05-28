"""Получение входящих писем через IMAP и их сохранение в БД."""
from __future__ import annotations

import email
import email.header
import imaplib
import json
import logging
import re
import ssl
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime, parseaddr
from typing import Optional

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.email_message import EmailMessage
from app.models.email_settings import EmailSettings

logger = logging.getLogger(__name__)


def _get_settings(db: Session) -> Optional[EmailSettings]:
    return db.query(EmailSettings).filter(EmailSettings.id == 1).first()


def _decode_header(value: str) -> str:
    """Декодирует заголовок письма (может быть в base64/quoted-printable)."""
    if not value:
        return ""
    parts = email.header.decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            try:
                decoded.append(part.decode(charset or "utf-8", errors="replace"))
            except Exception:
                decoded.append(part.decode("latin-1", errors="replace"))
        else:
            decoded.append(str(part))
    return " ".join(decoded).strip()


def _extract_body(msg: email.message.Message) -> tuple[str, str]:
    """Возвращает (text, html) тело письма."""
    text_body = ""
    html_body = ""

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if "attachment" in cd:
                continue
            charset = part.get_content_charset() or "utf-8"
            try:
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                content = payload.decode(charset, errors="replace")
                if ct == "text/plain" and not text_body:
                    text_body = content
                elif ct == "text/html" and not html_body:
                    html_body = content
            except Exception:
                pass
    else:
        charset = msg.get_content_charset() or "utf-8"
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                content = payload.decode(charset, errors="replace")
                ct = msg.get_content_type()
                if ct == "text/html":
                    html_body = content
                else:
                    text_body = content
        except Exception:
            pass

    return text_body, html_body


def _extract_attachments(msg: email.message.Message) -> list[dict]:
    attachments = []
    for part in msg.walk():
        cd = str(part.get("Content-Disposition", ""))
        if "attachment" in cd:
            filename = part.get_filename()
            if filename:
                attachments.append({
                    "name": _decode_header(filename),
                    "content_type": part.get_content_type(),
                })
    return attachments


def _compute_thread_id(msg_id: str, references: str, in_reply_to: str) -> str:
    """Определяет thread_id — берём самый первый Message-ID из цепочки."""
    chain = (references or "").strip() + " " + (in_reply_to or "").strip()
    ids = re.findall(r"<[^>]+>", chain)
    return ids[0].strip() if ids else msg_id


def _auto_link_client(db: Session, from_email: str) -> Optional[int]:
    """Ищет клиента по email и возвращает его ID."""
    if not from_email:
        return None
    client = db.query(Client).filter(Client.contact_email == from_email.lower()).first()
    return client.id if client else None


def sync_inbox(db: Session) -> dict:
    """Синхронизирует входящие письма из IMAP. Возвращает статистику."""
    cfg = _get_settings(db)
    if not cfg or not cfg.is_enabled:
        return {"synced": 0, "skipped": 0, "error": None}
    if not cfg.imap_username or not cfg.imap_password:
        return {"synced": 0, "skipped": 0, "error": "IMAP не настроен"}

    synced = 0
    skipped = 0

    try:
        context = ssl.create_default_context()
        if cfg.imap_use_ssl:
            imap = imaplib.IMAP4_SSL(cfg.imap_host, cfg.imap_port, ssl_context=context)
        else:
            imap = imaplib.IMAP4(cfg.imap_host, cfg.imap_port)

        imap.login(cfg.imap_username, cfg.imap_password)
        imap.select(cfg.imap_folder or "INBOX")

        # Уже сохранённые UID
        existing_uids = {
            r[0] for r in db.query(EmailMessage.message_uid)
            .filter(EmailMessage.direction == "in", EmailMessage.message_uid.isnot(None))
            .all()
        }

        _, data = imap.search(None, "ALL")
        all_ids = (data[0] or b"").split()

        # Берём последние 200 писем чтобы не перегружать
        fetch_ids = all_ids[-200:] if len(all_ids) > 200 else all_ids

        for num in reversed(fetch_ids):
            uid_str = num.decode()

            if uid_str in existing_uids:
                skipped += 1
                continue

            _, msg_data = imap.fetch(num, "(RFC822)")
            if not msg_data or not msg_data[0]:
                continue

            raw = msg_data[0][1]
            if not isinstance(raw, bytes):
                continue

            parsed = email.message_from_bytes(raw)

            msg_id_hdr = parsed.get("Message-ID", "").strip()
            references = parsed.get("References", "")
            in_reply_to = parsed.get("In-Reply-To", "")
            thread_id = _compute_thread_id(msg_id_hdr, references, in_reply_to)

            from_raw = parsed.get("From", "")
            from_name, from_email_addr = parseaddr(from_raw)
            from_name = _decode_header(from_name) if from_name else ""
            from_email_addr = from_email_addr.lower().strip()

            to_raw = _decode_header(parsed.get("To", ""))
            subject = _decode_header(parsed.get("Subject", ""))

            date_raw = parsed.get("Date", "")
            try:
                received_at = parsedate_to_datetime(date_raw).astimezone(timezone.utc).replace(tzinfo=None)
            except Exception:
                received_at = datetime.utcnow()

            body_text, body_html = _extract_body(parsed)
            attachments = _extract_attachments(parsed)
            client_id = _auto_link_client(db, from_email_addr)

            record = EmailMessage(
                message_uid=uid_str,
                message_id_hdr=msg_id_hdr or uid_str,
                thread_id=thread_id or msg_id_hdr or uid_str,
                direction="in",
                from_email=from_email_addr,
                from_name=from_name,
                to_email=to_raw,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
                received_at=received_at,
                is_read=False,
                attachments_json=json.dumps(attachments, ensure_ascii=False) if attachments else None,
                linked_client_id=client_id,
            )
            db.add(record)
            synced += 1

        db.commit()
        imap.logout()
        return {"synced": synced, "skipped": skipped, "error": None}

    except Exception as e:
        logger.error("IMAP sync error: %s", e)
        return {"synced": synced, "skipped": skipped, "error": str(e)}


def test_imap(cfg: EmailSettings) -> dict:
    """Проверяет IMAP-подключение."""
    try:
        context = ssl.create_default_context()
        if cfg.imap_use_ssl:
            imap = imaplib.IMAP4_SSL(cfg.imap_host, cfg.imap_port, ssl_context=context)
        else:
            imap = imaplib.IMAP4(cfg.imap_host, cfg.imap_port)
        imap.login(cfg.imap_username, cfg.imap_password)
        imap.logout()
        return {"ok": True, "message": "IMAP подключение успешно"}
    except Exception as e:
        return {"ok": False, "message": str(e)}
