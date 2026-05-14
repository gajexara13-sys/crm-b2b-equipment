"""Диагностика каталога: какой SQLite выбран и сколько товаров."""
import os
import sys
import sqlite3
from pathlib import Path

# как при импорте приложения без переменных окружения для БД
os.environ.pop("CRM_B2B_DATABASE_URL", None)
os.environ.pop("DATABASE_URL", None)


def main() -> None:
    here = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(here))
    os.chdir(here)
    from app.database import DATABASE_URL

    print("DATABASE_URL ->", DATABASE_URL)
    raw = DATABASE_URL.replace("sqlite:///", "").strip()
    if raw.startswith("/") and len(raw) > 2 and raw[2] == ":":
        raw = raw[1:]
    p = Path(raw)
    print("Файл:", p, "| exists:", p.exists())
    if not p.exists():
        return

    conn = sqlite3.connect(str(p))
    n = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    print("products:", n)
    for row in conn.execute(
        "SELECT id, name, is_active, sku FROM products ORDER BY id LIMIT 15"
    ).fetchall():
        print(" ", row)
    conn.close()

    repo = here.parent
    for name, fp in [
        ("data/dev.db", repo / "data" / "dev.db"),
        ("backend/crm.db", here / "crm.db"),
    ]:
        if not fp.is_file():
            print(name, "- нет файла")
            continue
        c = sqlite3.connect(str(fp))
        try:
            pn = c.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        except Exception as e:
            pn = str(e)
        c.close()
        print(f"{name}: products =", pn)


if __name__ == "__main__":
    main()
