"""Загрузка файлов (изображений) на сервер."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.routers.auth import get_current_user

router = APIRouter()

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"}
MAX_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Разрешены только изображения (PNG/JPG/GIF/WEBP), получен: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой (максимум 10 МБ)")

    ext = Path(file.filename or "file.png").suffix.lower() or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / filename).write_bytes(data)

    return {"url": f"/uploads/{filename}"}
