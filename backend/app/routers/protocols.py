from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import load_workbook
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.protocol import Protocol
from app.models.test import Test
from app.models.sample import Sample
from app.models.client import Client
from app.models.request import Request
from app.routers.auth import get_current_user
from app import config as app_config
from app.services import protocol_generator
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()

_MAX_TEMPLATE_BYTES = 20 * 1024 * 1024

class ProtocolIn(BaseModel):
    sample_id: int
    test_id: int
    conclusion: Optional[str] = None
    notes: Optional[str] = None

@router.get("/templates/status")
def protocol_templates_status(_=Depends(get_current_user)):
    """Проверка, что шаблоны протоколов доступны по сконфигурированному пути."""
    out = {}
    for test_type in app_config.PROTOCOL_TEMPLATE_FILENAMES:
        out[test_type] = {"available": app_config.protocol_template_available(test_type)}
    return {"templates_dir": str(app_config.protocol_templates_dir()), "templates": out}


@router.post("/templates/upload/{test_type}")
async def upload_protocol_template(
    test_type: str,
    file: UploadFile = File(...),
    _user=Depends(get_current_user),
):
    """
    Загрузка пустого шаблона .xlsx на сервер (папка из PROTOCOL_TEMPLATES_DIR или значение по умолчанию).
    """
    filename = app_config.PROTOCOL_TEMPLATE_FILENAMES.get(test_type)
    if not filename:
        raise HTTPException(400, f"Неизвестный тип шаблона: {test_type}")

    raw_name = (file.filename or "").lower()
    if not raw_name.endswith(".xlsx"):
        raise HTTPException(400, "Нужен файл в формате .xlsx")

    content = await file.read()
    if len(content) > _MAX_TEMPLATE_BYTES:
        raise HTTPException(413, "Файл слишком большой (макс. 20 МБ)")
    if len(content) == 0:
        raise HTTPException(400, "Пустой файл")

    try:
        load_workbook(BytesIO(content), read_only=True).close()
    except Exception as e:
        raise HTTPException(400, f"Файл не читается как Excel: {e!s}") from e

    dest_dir = app_config.protocol_templates_dir()
    try:
        dest_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise HTTPException(
            500,
            f"Не удалось создать каталог для шаблонов ({dest_dir}): {e!s}",
        ) from e

    dest = dest_dir / filename
    try:
        dest.write_bytes(content)
    except OSError as e:
        raise HTTPException(
            500,
            f"Не удалось сохранить шаблон (проверьте права на каталог или PROTOCOL_TEMPLATES_DIR): {e!s}",
        ) from e

    return {"ok": True, "test_type": test_type, "saved_as": filename}


@router.get("")
def list_protocols(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Protocol).order_by(Protocol.number.desc()).all()

@router.post("")
def create_protocol(data: ProtocolIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    last = db.query(Protocol).order_by(Protocol.number.desc()).first()
    number = (last.number + 1) if last else 1
    p = Protocol(**data.dict(), number=number, laborant_id=user.id, status="draft")
    db.add(p); db.commit(); db.refresh(p)
    return p

@router.post("/for-test/{test_id}")
def recreate_protocol_for_test(test_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Удаляет существующий протокол для испытания и создаёт новый с новым номером."""
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Испытание не найдено")
    # Сохраняем заключение из старого протокола
    old = db.query(Protocol).filter(Protocol.test_id == test_id).first()
    old_conclusion = old.conclusion if old else None
    old_notes = old.notes if old else None
    if old:
        db.delete(old); db.commit()
    last = db.query(Protocol).order_by(Protocol.number.desc()).first()
    number = (last.number + 1) if last else 1
    p = Protocol(
        sample_id=test.sample_id, test_id=test.id,
        conclusion=old_conclusion, notes=old_notes,
        number=number, laborant_id=user.id, status="draft"
    )
    db.add(p); db.commit(); db.refresh(p)
    return p

class ProtocolUpdate(BaseModel):
    conclusion: Optional[str] = None
    notes: Optional[str] = None

@router.put("/{id}")
def update_protocol(id: int, data: ProtocolUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Protocol).filter(Protocol.id == id).first()
    if not p:
        raise HTTPException(404, "Протокол не найден")
    if data.conclusion is not None:
        p.conclusion = data.conclusion
    if data.notes is not None:
        p.notes = data.notes
    db.commit()
    db.refresh(p)
    return p


@router.put("/{id}/sign")
def sign_protocol(id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role not in ("lab_head", "admin"):
        raise HTTPException(403, "Только начальник лаборатории может подписывать протоколы")
    p = db.query(Protocol).filter(Protocol.id == id).first()
    if not p: raise HTTPException(404, "Протокол не найден")
    p.status = "signed"; p.lab_head_id = user.id; p.signed_at = datetime.utcnow()
    db.commit(); db.refresh(p)
    return p

@router.put("/{id}/status")
def update_status(id: int, status: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Protocol).filter(Protocol.id == id).first()
    if not p: raise HTTPException(404, "Протокол не найден")
    p.status = status; db.commit(); db.refresh(p)
    return p

@router.get("/{id}/generate")
def generate_protocol(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Генерирует заполненный .xlsx протокол и отдаёт его на скачивание."""
    p = db.query(Protocol).filter(Protocol.id == id).first()
    if not p:
        raise HTTPException(404, "Протокол не найден")

    test = db.query(Test).filter(Test.id == p.test_id).first()
    if not test:
        raise HTTPException(422, "К протоколу не привязано испытание")

    sample = db.query(Sample).filter(Sample.id == p.sample_id).first()
    if not sample:
        raise HTTPException(422, "К протоколу не привязана проба")

    request = db.query(Request).filter(Request.id == sample.request_id).first() if sample.request_id else None
    client = db.query(Client).filter(Client.id == request.client_id).first() if request and request.client_id else None

    try:
        buf = protocol_generator.generate(p, test, sample, client, request)
    except FileNotFoundError as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))

    filename = f"protocol_{p.number:05d}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.get("/{id}")
def get_protocol(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Protocol).filter(Protocol.id == id).first()
    if not p: raise HTTPException(404, "Протокол не найден")
    return p
