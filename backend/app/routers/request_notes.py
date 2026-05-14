from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.request_note import RequestNote
from app.models.request import Request
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter()

class NoteIn(BaseModel):
    note_type: Optional[str] = "note"
    content: str

@router.get("/{request_id}/notes")
def list_notes(request_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(404, "Заявка не найдена")
    notes = (
        db.query(RequestNote, User)
        .outerjoin(User, RequestNote.author_id == User.id)
        .filter(RequestNote.request_id == request_id)
        .order_by(RequestNote.created_at.desc())
        .all()
    )
    return [
        {
            "id": n.id,
            "request_id": n.request_id,
            "note_type": n.note_type,
            "content": n.content,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "author_name": u.name if u else "—",
            "author_id": n.author_id,
        }
        for n, u in notes
    ]

@router.post("/{request_id}/notes")
def add_note(request_id: int, data: NoteIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(404, "Заявка не найдена")
    if not data.content.strip():
        raise HTTPException(422, "Текст заметки не может быть пустым")
    note = RequestNote(
        request_id=request_id,
        author_id=user.id,
        note_type=data.note_type or "note",
        content=data.content.strip(),
    )
    db.add(note); db.commit(); db.refresh(note)
    author = db.query(User).filter(User.id == user.id).first()
    return {
        "id": note.id,
        "request_id": note.request_id,
        "note_type": note.note_type,
        "content": note.content,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "author_name": author.name if author else "—",
        "author_id": note.author_id,
    }

@router.delete("/{request_id}/notes/{note_id}")
def delete_note(request_id: int, note_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    note = db.query(RequestNote).filter(RequestNote.id == note_id, RequestNote.request_id == request_id).first()
    if not note:
        raise HTTPException(404, "Запись не найдена")
    if note.author_id != user.id and user.role not in ("admin", "lab_head"):
        raise HTTPException(403, "Нет прав для удаления")
    db.delete(note); db.commit()
    return {"ok": True}
