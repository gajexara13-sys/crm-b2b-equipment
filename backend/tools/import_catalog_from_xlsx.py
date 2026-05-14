"""
Импорт каталога товаров из Excel в CRM RUTEST.
Запуск: python backend/tools/import_catalog_from_xlsx.py <путь_к_xlsx>

Что делает:
- Обновляет отображаемые имена категорий до читаемых русских названий
- Добавляет недостающие категории
- Импортирует 127 товаров из листа «CSV для CRM»
- Пропускает дубликаты (по имени), обновляет если запустить повторно
"""
import sys
import re
import json
import sqlite3
from pathlib import Path

import pandas as pd

SKIP_PATTERNS = re.compile(
    r"^(характеристики\s+товара|технические\s+характеристики|главная\s+особенность|описание\s+товара)$",
    re.IGNORECASE,
)


def text_to_spec_json(text: str) -> str:
    """Парсит текстовые характеристики в JSON [{key, value}]."""
    if not text:
        return "[]"
    rows = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line or SKIP_PATTERNS.match(line):
            continue
        line = re.sub(r"^\d+\.\s*", "", line)
        line = re.sub(r"^[•·\-–]\s*", "", line).strip()
        if not line:
            continue
        idx = line.find(":")
        if idx > 0:
            rows.append({"key": line[:idx].strip(), "value": line[idx + 1:].strip()})
        else:
            rows.append({"key": "", "value": line})
    return json.dumps(rows, ensure_ascii=False)

# ── пути ─────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DB_CANDIDATES = [
    REPO_ROOT / "data" / "dev.db",
    REPO_ROOT / "backend" / "crm.db",
]


def pick_db() -> Path:
    best, best_count = None, -1
    for p in DB_CANDIDATES:
        if not p.exists():
            continue
        try:
            c = sqlite3.connect(str(p))
            n = c.execute("SELECT COUNT(*) FROM products").fetchone()[0]
            c.close()
            if n > best_count:
                best, best_count = p, n
        except Exception:
            pass
    if best is None:
        raise RuntimeError("SQLite-база не найдена")
    return best


# ── маппинг категорий Excel → code в БД ──────────────────────────────────────
CATEGORY_MAP = {
    "Асфальтобетоны":               ("asphalt",          "Асфальтобетоны"),
    "Каменные заполнители":         ("inert",            "Каменные заполнители"),
    "Битумные вяжущие":             ("bitumen",          "Битумные вяжущие"),
    "Минеральные порошки":          ("mineral_powder",   "Минеральные порошки"),
    "Бетоны и растворы":            ("concrete",         "Бетоны и растворы"),
    "Цементные вяжущие":            ("cement_binder",    "Цементные вяжущие"),
    "Укрепленные грунты":           ("stabilized_soils", "Укрепленные грунты"),
    "Грунты и почвы":               ("soils",            "Грунты и почвы"),
    "Общелабораторное оборудование":("general_lab",      "Общелабораторное оборудование"),
}

# Старые коды из seed_product_categories → новый code, если нужно переименовать
OLD_CODE_RENAMES = {
    "asphalt":          "asphalt",
    "inert":            "inert",
    "bitumen":          "bitumen",
    "mineral_binder":   "mineral_binder",
    "concrete":         "concrete",
    "stabilized_soils": "stabilized_soils",
    "soils":            "soils",
    "field_measurements": "field_measurements",
    "general_lab":      "general_lab",
}

# Принудительное обновление имён существующих категорий (code → display name)
DISPLAY_NAME_FIXES = {
    "asphalt":          "Асфальтобетоны",
    "inert":            "Каменные заполнители",
    "bitumen":          "Битумные вяжущие",
    "concrete":         "Бетоны и растворы",
    "stabilized_soils": "Укрепленные грунты",
    "soils":            "Грунты и почвы",
    "general_lab":      "Общелабораторное оборудование",
    "mineral_binder":   "Цементные вяжущие",
    "field_measurements": "Полевые измерения",
}


def parse_price(raw) -> float:
    if not raw or (isinstance(raw, float) and pd.isna(raw)):
        return 0.0
    s = str(raw)
    if "запрос" in s.lower():
        return 0.0
    nums = re.sub(r"[^\d.]", "", s.replace(",", "."))
    try:
        return float(nums)
    except ValueError:
        return 0.0


def ensure_categories(conn: sqlite3.Connection) -> dict[str, int]:
    """Возвращает {excel_category_name: db_id}."""
    # Обновляем имена существующих категорий
    for code, name in DISPLAY_NAME_FIXES.items():
        conn.execute(
            "UPDATE product_categories SET name=? WHERE code=?", (name, code)
        )

    # Добавляем недостающие
    for excel_name, (code, display) in CATEGORY_MAP.items():
        exists = conn.execute(
            "SELECT id FROM product_categories WHERE code=?", (code,)
        ).fetchone()
        if not exists:
            conn.execute(
                "INSERT INTO product_categories (code, name) VALUES (?, ?)",
                (code, display),
            )

    conn.commit()

    rows = conn.execute(
        "SELECT id, code, name FROM product_categories"
    ).fetchall()
    code_to_id = {r[1]: r[0] for r in rows}
    name_to_id: dict[str, int] = {}
    for excel_name, (code, _) in CATEGORY_MAP.items():
        if code in code_to_id:
            name_to_id[excel_name] = code_to_id[code]
    return name_to_id


def import_products(conn: sqlite3.Connection, df: pd.DataFrame, cat_map: dict[str, int]):
    inserted = updated = skipped = 0

    for _, row in df.iterrows():
        name = str(row.get("name", "")).strip()
        if not name:
            continue

        model = str(row.get("model", "")) if pd.notna(row.get("model")) else ""
        sku = str(row.get("sku", "")).strip() if pd.notna(row.get("sku")) else None
        if not sku:
            sku = None

        cat_name = str(row.get("category", "")).strip()
        category_id = cat_map.get(cat_name)

        brand = str(row.get("brand", "")).strip() if pd.notna(row.get("brand")) else None
        price = parse_price(row.get("price"))

        description = str(row.get("description", "")).strip() if pd.notna(row.get("description")) else ""
        raw_specs = str(row.get("specifications", "")).strip() if pd.notna(row.get("specifications")) else ""
        tech_specs = text_to_spec_json(raw_specs) if raw_specs else "[]"

        image_url = str(row.get("image_url", "")).strip() if pd.notna(row.get("image_url")) else ""
        photo_urls_json = json.dumps([image_url], ensure_ascii=False) if image_url else "[]"

        website_url = str(row.get("product_url", "")).strip() if pd.notna(row.get("product_url")) else ""

        existing = conn.execute(
            "SELECT id FROM products WHERE name=?", (name,)
        ).fetchone()

        if existing:
            conn.execute(
                """UPDATE products SET
                    category_id=?, sku=?, brand=?, price_end_vat=?,
                    description=?, tech_specs=?, photo_urls_json=?,
                    website_url=?, product_status='active',
                    equipment_type='Испытательное оборудование'
                WHERE id=?""",
                (category_id, sku, brand, price,
                 description, tech_specs, photo_urls_json,
                 website_url, existing[0]),
            )
            updated += 1
        else:
            conn.execute(
                """INSERT INTO products
                    (category_id, sku, name, brand, price_end_vat,
                     description, tech_specs, photo_urls_json,
                     website_url, product_status, equipment_type,
                     stock_quantity, is_active)
                VALUES (?,?,?,?,?,?,?,?,?,'active','Испытательное оборудование',0,1)""",
                (category_id, sku, name, brand, price,
                 description, tech_specs, photo_urls_json, website_url),
            )
            inserted += 1

    conn.commit()
    return inserted, updated


def main():
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("C:/Users/user/Downloads/catalog.xlsx")
    if not xlsx_path.exists():
        print(f"Файл не найден: {xlsx_path}")
        sys.exit(1)

    db_path = pick_db()
    print(f"База: {db_path}")

    df = pd.read_excel(xlsx_path, sheet_name="CSV для CRM")
    print(f"Загружено {len(df)} строк из Excel")

    conn = sqlite3.connect(str(db_path))

    cat_map = ensure_categories(conn)
    print(f"Категории настроены: {len(cat_map)} штук")

    inserted, updated = import_products(conn, df, cat_map)
    conn.close()

    total = conn.execute  # just reference, db closed
    print(f"\nГотово!")
    print(f"  Новых товаров:    {inserted}")
    print(f"  Обновлено:        {updated}")


if __name__ == "__main__":
    main()
