from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.catalog_csv import iter_accreditation_rows, iter_accreditation_rows_from_text
from app.database import get_db
from app.models.catalog_item import CatalogItem
from app.models.material_norm import MaterialNorm
from app.routers.auth import get_current_user

router = APIRouter()

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_DEFAULT_CSV = _DATA_DIR / "accreditation_scope.csv"


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


class CatalogPatch(BaseModel):
    price_rub: float | None


@router.get("/items")
def list_items(
    q: str | None = None,
    material_norm_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(CatalogItem).order_by(CatalogItem.sort_order, CatalogItem.id)
    rows = query.all()
    if material_norm_id is not None:
        mn = db.query(MaterialNorm).filter(MaterialNorm.id == material_norm_id).first()
        if not mn:
            raise HTTPException(404, "Материал из справочника не найден")
        label = (mn.material_label or "").strip().lower()
        parts = [p.strip().lower() for p in (mn.material_label or "").replace("\r\n", "\n").split("\n") if p.strip()]

        def match(blob: str) -> bool:
            b = (blob or "").lower()
            if label and label in b:
                return True
            return any(len(p) > 2 and p in b for p in parts)

        rows = [r for r in rows if match(r.material_object or "")]
    if q:
        s = q.lower().strip()
        rows = [
            r
            for r in rows
            if s in (r.material_object or "").lower()
            or s in (r.characteristic or "").lower()
            or s in (r.range_text or "").lower()
            or s in (r.standard_ref or "").lower()
        ]
    return rows


@router.patch("/items/{item_id}")
def patch_item(
    item_id: int,
    data: CatalogPatch,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    item = db.query(CatalogItem).filter(CatalogItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Позиция не найдена")
    if data.price_rub is not None and data.price_rub < 0:
        raise HTTPException(400, "Цена не может быть отрицательной")
    item.price_rub = data.price_rub
    db.commit()
    db.refresh(item)
    return item


@router.post("/import-default")
def import_default_csv(
    force: bool = Query(False, description="Удалить текущий каталог и загрузить заново (цены будут потеряны)"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if not _DEFAULT_CSV.is_file():
        raise HTTPException(404, f"Файл не найден: {_DEFAULT_CSV}")

    existing = db.query(CatalogItem).count()
    if existing > 0 and not force:
        raise HTTPException(
            409,
            "В каталоге уже есть записи. Повторный импорт с очисткой: POST /api/catalog/import-default?force=true",
        )

    if force:
        db.query(CatalogItem).delete()

    n = 0
    for order, row in enumerate(iter_accreditation_rows(_DEFAULT_CSV)):
        db.add(
            CatalogItem(
                material_object=row.material_object,
                characteristic=row.characteristic,
                range_text=row.range_text or None,
                standard_ref=row.standard_ref or None,
                price_rub=None,
                sort_order=order,
            )
        )
        n += 1

    db.commit()
    return {"imported": n, "file": str(_DEFAULT_CSV.name)}


@router.post("/import-upload")
async def import_upload_csv(
    force: bool = Query(False, description="Удалить текущий каталог и загрузить из файла (цены будут потеряны)"),
    file: UploadFile = File(..., description="CSV с разделителем «;», как accreditation_scope.csv"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Пустой файл")
    text = _decode_csv_bytes(raw)
    parsed = list(iter_accreditation_rows_from_text(text))
    if not parsed:
        raise HTTPException(
            400,
            "В файле нет строк для импорта. Проверьте разделитель «;», заголовок и формат столбцов.",
        )

    existing = db.query(CatalogItem).count()
    if existing > 0 and not force:
        raise HTTPException(
            409,
            "В каталоге уже есть записи. Повторный импорт: POST /api/catalog/import-upload?force=true",
        )

    if force:
        db.query(CatalogItem).delete()

    n = 0
    for order, row in enumerate(parsed):
        db.add(
            CatalogItem(
                material_object=row.material_object,
                characteristic=row.characteristic,
                range_text=row.range_text or None,
                standard_ref=row.standard_ref or None,
                price_rub=None,
                sort_order=order,
            )
        )
        n += 1

    db.commit()
    return {"imported": n, "file": file.filename or "upload.csv"}
