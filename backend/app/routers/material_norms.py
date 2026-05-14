import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.material_norm_csv import iter_material_norm_rows, iter_material_norm_rows_from_text
from app.models.material_norm import MaterialNorm
from app.models.sample import Sample
from app.routers.auth import get_current_user

router = APIRouter()

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_DEFAULT_CSV = _DATA_DIR / "material_objects_categories.csv"


def _decode_csv_bytes(raw: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise HTTPException(
        status_code=400,
        detail="Не удалось прочитать файл: сохраните CSV в кодировке UTF-8 или Windows-1251.",
    )


class MaterialNormOut(BaseModel):
    id: int
    category_label: str
    material_label: str
    primary_standards: list[str]
    additional_standards: list[str]


def _row_out(r: MaterialNorm) -> MaterialNormOut:
    return MaterialNormOut(
        id=r.id,
        category_label=getattr(r, "category_label", None) or "",
        material_label=r.material_label,
        primary_standards=json.loads(r.primary_standards_json or "[]"),
        additional_standards=json.loads(r.additional_standards_json or "[]"),
    )


@router.get("", response_model=list[MaterialNormOut])
def list_material_norms(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.query(MaterialNorm).order_by(MaterialNorm.sort_order, MaterialNorm.id).all()
    return [_row_out(r) for r in rows]


@router.get("/{norm_id}", response_model=MaterialNormOut)
def get_material_norm(norm_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    r = db.query(MaterialNorm).filter(MaterialNorm.id == norm_id).first()
    if not r:
        raise HTTPException(404, "Запись не найдена")
    return _row_out(r)


@router.post("/import-default")
def import_default_csv(
    force: bool = Query(False, description="Очистить справочник и загрузить заново"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if not _DEFAULT_CSV.is_file():
        raise HTTPException(404, f"Файл не найден: {_DEFAULT_CSV}")

    existing = db.query(MaterialNorm).count()
    if existing > 0 and not force:
        raise HTTPException(
            409,
            "Справочник уже заполнен. Повторный импорт: POST /api/material-norms/import-default?force=true",
        )

    if force:
        for s in db.query(Sample).filter(Sample.material_norm_id.isnot(None)).all():
            s.material_norm_id = None
        db.flush()
        db.query(MaterialNorm).delete()

    n = 0
    for order, row in enumerate(iter_material_norm_rows(_DEFAULT_CSV)):
        db.add(
            MaterialNorm(
                category_label=row.category_label,
                material_label=row.material_label,
                primary_standards_json=json.dumps(row.primary_standards, ensure_ascii=False),
                additional_standards_json=json.dumps(row.additional_standards, ensure_ascii=False),
                sort_order=order,
            )
        )
        n += 1

    db.commit()
    return {"imported": n, "file": str(_DEFAULT_CSV.name)}


@router.post("/import-upload")
async def import_upload_csv(
    force: bool = Query(False, description="Очистить справочник и загрузить заново"),
    file: UploadFile = File(..., description="CSV с разделителем «;», как material_objects_categories.csv"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Пустой файл")
    text = _decode_csv_bytes(raw)
    parsed = list(iter_material_norm_rows_from_text(text))
    if not parsed:
        raise HTTPException(
            400,
            "В файле нет строк для импорта. Проверьте разделитель «;», заголовок и формат столбцов.",
        )

    existing = db.query(MaterialNorm).count()
    if existing > 0 and not force:
        raise HTTPException(
            409,
            "Справочник уже заполнен. Повторный импорт: POST /api/material-norms/import-upload?force=true",
        )

    if force:
        for s in db.query(Sample).filter(Sample.material_norm_id.isnot(None)).all():
            s.material_norm_id = None
        db.flush()
        db.query(MaterialNorm).delete()

    n = 0
    for order, row in enumerate(parsed):
        db.add(
            MaterialNorm(
                category_label=row.category_label,
                material_label=row.material_label,
                primary_standards_json=json.dumps(row.primary_standards, ensure_ascii=False),
                additional_standards_json=json.dumps(row.additional_standards, ensure_ascii=False),
                sort_order=order,
            )
        )
        n += 1

    db.commit()
    return {"imported": n, "file": file.filename or "upload.csv"}
