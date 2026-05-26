"""Хелпер для записи событий в audit_log.

Использование:
    from app.audit import log_action

    @router.delete("/{id}")
    def delete_request(id, request: Request, ...):
        ...
        log_action(db, user, "delete_request", "request", id,
                   details={"number": r.number, "tasks_deleted": tasks_count},
                   request=request)
        ...
"""

from __future__ import annotations
import json
import logging
from typing import Optional

from fastapi import Request as FastAPIRequest
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User

_log = logging.getLogger(__name__)


def _client_ip(request: Optional[FastAPIRequest]) -> Optional[str]:
    if request is None:
        return None
    fwd = (request.headers.get("X-Forwarded-For") or "").split(",")
    if fwd and fwd[0].strip():
        return fwd[0].strip()
    return request.client.host if request.client else None


def log_action(
    db: Session,
    user: Optional[User],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[dict] = None,
    request: Optional[FastAPIRequest] = None,
) -> None:
    """Записывает событие в audit_log. Никогда не бросает исключения наружу —
    падение журнала не должно ломать основной запрос."""
    try:
        entry = AuditLog(
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            user_role=user.role if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=json.dumps(details, ensure_ascii=False) if details else None,
            ip=_client_ip(request),
        )
        db.add(entry)
        # commit делает вызывающий код своим основным commit'ом —
        # мы только добавляем в сессию, чтобы запись попала в одну транзакцию
    except Exception as e:
        _log.warning("Не удалось записать audit-log %s/%s: %s", action, entity_type, e)
