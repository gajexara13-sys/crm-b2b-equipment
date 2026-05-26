import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter()


def _require_admin(user: User) -> None:
    if user.role not in ("admin", "lab_head"):
        raise HTTPException(403, "Доступ только для администратора")


def _entry_to_dict(e: AuditLog) -> dict:
    try:
        details = json.loads(e.details) if e.details else None
    except Exception:
        details = e.details
    return {
        "id":          e.id,
        "user_id":     e.user_id,
        "user_email":  e.user_email,
        "user_role":   e.user_role,
        "action":      e.action,
        "entity_type": e.entity_type,
        "entity_id":   e.entity_id,
        "details":     details,
        "ip":          e.ip,
        "created_at":  e.created_at,
    }


@router.get("")
def list_audit_log(
    action:      Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id:     Optional[int] = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Журнал действий. Доступен только admin/lab_head."""
    _require_admin(user)
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if user_id is not None:
        q = q.filter(AuditLog.user_id == user_id)
    total = q.count()
    rows = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [_entry_to_dict(r) for r in rows],
    }
