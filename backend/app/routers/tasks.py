from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.deal_task import DealTask
from app.models.request import Request
from app.models.client import Client
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter()

TASK_TYPES = frozenset({"call", "kp", "meeting", "payment"})


class TaskIn(BaseModel):
    request_id: int
    task_type: str
    due_at: datetime
    note: Optional[str] = None
    assigned_to: Optional[int] = None


class TaskPatch(BaseModel):
    task_type: Optional[str] = None
    due_at: Optional[datetime] = None
    note: Optional[str] = None
    completed: Optional[bool] = None


def _end_of_today_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=23, minute=59, second=59, microsecond=999999)


@router.get("/today")
def list_today(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Незавершённые задачи с дедлайном сегодня или просроченные."""
    limit = _end_of_today_utc()
    q = (
        db.query(DealTask, Request, Client)
        .join(Request, DealTask.request_id == Request.id)
        .outerjoin(Client, Request.client_id == Client.id)
        .filter(DealTask.assigned_to == user.id)
        .filter(DealTask.completed_at.is_(None))
        .filter(DealTask.due_at.isnot(None))
        .filter(DealTask.due_at <= limit)
    )
    rows = q.order_by(DealTask.due_at.asc()).all()
    return [_task_row(t, req, cl) for t, req, cl in rows]


@router.get("/all")
def list_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Все незавершённые задачи пользователя, отсортированные по дедлайну."""
    q = (
        db.query(DealTask, Request, Client)
        .join(Request, DealTask.request_id == Request.id)
        .outerjoin(Client, Request.client_id == Client.id)
        .filter(DealTask.assigned_to == user.id)
        .filter(DealTask.completed_at.is_(None))
        .filter(DealTask.due_at.isnot(None))
    )
    rows = q.order_by(DealTask.due_at.asc()).all()
    return [_task_row(t, req, cl) for t, req, cl in rows]


def _task_row(t: DealTask, req: Request, cl) -> dict:
    return {
        "id": t.id,
        "request_id": t.request_id,
        "task_type": t.task_type,
        "due_at": t.due_at,
        "note": t.note,
        "completed_at": t.completed_at,
        "request_number": req.number,
        "request_stage": req.stage,
        "client_name": cl.name if cl else None,
    }


@router.get("/history")
def list_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Завершённые задачи пользователя (выполненные и невыполненные), новые сначала."""
    q = (
        db.query(DealTask, Request, Client)
        .join(Request, DealTask.request_id == Request.id)
        .outerjoin(Client, Request.client_id == Client.id)
        .filter(DealTask.assigned_to == user.id)
        .filter(DealTask.completed_at.isnot(None))
    )
    rows = q.order_by(DealTask.completed_at.desc()).all()
    return [_task_row(t, req, cl) for t, req, cl in rows]


@router.get("/by-request/{request_id}")
def list_by_request(
    request_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    r = db.query(Request).filter(Request.id == request_id).first()
    if not r:
        raise HTTPException(404, "Заявка не найдена")
    tasks = (
        db.query(DealTask)
        .filter(DealTask.request_id == request_id)
        .order_by(DealTask.due_at.desc())
        .all()
    )
    return tasks


@router.post("")
def create_task(
    data: TaskIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    if data.task_type not in TASK_TYPES:
        raise HTTPException(400, "Некорректный тип задачи")
    r = db.query(Request).filter(Request.id == data.request_id).first()
    if not r:
        raise HTTPException(404, "Заявка не найдена")
    assign = data.assigned_to if data.assigned_to is not None else user.id
    if db.query(User).filter(User.id == assign).first() is None:
        raise HTTPException(400, "Исполнитель не найден")
    t = DealTask(
        request_id=data.request_id,
        assigned_to=assign,
        task_type=data.task_type,
        due_at=data.due_at,
        note=data.note,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.patch("/{task_id}")
def patch_task(
    task_id: int,
    body: TaskPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(DealTask).filter(DealTask.id == task_id).first()
    if not t:
        raise HTTPException(404, "Задача не найдена")
    if t.assigned_to != user.id and user.role not in ("admin", "lab_head"):
        raise HTTPException(403, "Нет доступа к задаче")
    if body.task_type is not None:
        if body.task_type not in TASK_TYPES:
            raise HTTPException(400, "Некорректный тип задачи")
        t.task_type = body.task_type
    if body.due_at is not None:
        t.due_at = body.due_at
    if body.note is not None:
        t.note = body.note
    if body.completed is True:
        t.completed_at = datetime.now(timezone.utc)
    elif body.completed is False:
        t.completed_at = None
    db.commit()
    db.refresh(t)
    return t
