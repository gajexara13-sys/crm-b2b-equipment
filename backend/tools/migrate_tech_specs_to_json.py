"""
Миграция tech_specs: текст → JSON [{key, value}]

Запуск: python backend/tools/migrate_tech_specs_to_json.py [--dry-run]
"""
import json
import re
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DB_CANDIDATES = [
    REPO_ROOT / "data" / "dev.db",
    REPO_ROOT / "backend" / "crm.db",
]

SKIP_PATTERNS = re.compile(
    r"^(характеристики\s+товара|технические\s+характеристики|главная\s+особенность|описание\s+товара)$",
    re.IGNORECASE,
)


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


def parse_text_to_rows(text: str) -> list[dict]:
    rows = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        # Убираем заголовки
        if SKIP_PATTERNS.match(line):
            continue
        # Убираем нумерацию и маркеры: "1.", "2.", "•", "·", "-"
        line = re.sub(r"^\d+\.\s*", "", line)
        line = re.sub(r"^[•·\-–]\s*", "", line).strip()
        if not line:
            continue
        # Делим по первому двоеточию
        idx = line.find(":")
        if idx > 0:
            key = line[:idx].strip()
            value = line[idx + 1:].strip()
        else:
            key = ""
            value = line
        if key or value:
            rows.append({"key": key, "value": value})
    return rows


def is_already_json(text: str) -> bool:
    try:
        data = json.loads(text)
        return isinstance(data, list)
    except Exception:
        return False


def main():
    dry_run = "--dry-run" in sys.argv
    db_path = pick_db()
    print(f"База: {db_path}")

    conn = sqlite3.connect(str(db_path))
    rows = conn.execute(
        "SELECT id, tech_specs FROM products WHERE tech_specs IS NOT NULL AND length(tech_specs) > 0"
    ).fetchall()

    converted = skipped = already_json = 0
    for pid, specs in rows:
        if is_already_json(specs):
            already_json += 1
            continue
        parsed = parse_text_to_rows(specs)
        if not parsed:
            skipped += 1
            continue
        new_val = json.dumps(parsed, ensure_ascii=False)
        if not dry_run:
            conn.execute("UPDATE products SET tech_specs=? WHERE id=?", (new_val, pid))
        converted += 1

    if not dry_run:
        conn.commit()
    conn.close()

    action = "[DRY RUN] " if dry_run else ""
    print(f"\n{action}Готово:")
    print(f"  Уже в JSON:    {already_json}")
    print(f"  Конвертировано: {converted}")
    print(f"  Пропущено:     {skipped}")


if __name__ == "__main__":
    main()
