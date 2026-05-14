from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
import sqlite3
import warnings
from pathlib import Path

# Локально: два возможных пути SQLite — data/dev.db и backend/crm.db.
# Если оба есть: сначала сравниваем число товаров (products), при равенстве — число КП (commercial_quotes),
# чтобы каталог и КП не рассинхронизовались между файлами.
#
# Приоритет URL: CRM_B2B_DATABASE_URL → DATABASE_URL → автовыбор файла.
# Для SQLite из окружения путь вне корня репозитория игнорируется (частая ошибка — чужой CRM в системном DATABASE_URL).
# PostgreSQL и др. драйверы не трогаем.
# Локальные переменные — в .env в корне репозитория (шаблон: .env.example).
_backend_dir = Path(__file__).resolve().parent.parent
_repo_root = _backend_dir.parent
load_dotenv(_repo_root / ".env")
_dev_sqlite = _repo_root / "data" / "dev.db"
_legacy_sqlite = _backend_dir / "crm.db"


def _table_row_count(db_path: Path, table: str) -> int:
    if not db_path.is_file():
        return -1
    try:
        conn = sqlite3.connect(str(db_path))
        cur = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        if cur.fetchone() is None:
            conn.close()
            return 0
        n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        conn.close()
        return int(n)
    except Exception:
        return -1


def _pick_default_sqlite() -> Path:
    dev_ex = _dev_sqlite.exists()
    leg_ex = _legacy_sqlite.exists()
    if dev_ex and leg_ex:
        pd = _table_row_count(_dev_sqlite, "products")
        pl = _table_row_count(_legacy_sqlite, "products")
        qd = _table_row_count(_dev_sqlite, "commercial_quotes")
        ql = _table_row_count(_legacy_sqlite, "commercial_quotes")
        if pl != pd:
            return _legacy_sqlite if pl > pd else _dev_sqlite
        if ql != qd:
            return _legacy_sqlite if ql > qd else _dev_sqlite
        return _dev_sqlite
    if dev_ex:
        return _dev_sqlite
    if leg_ex:
        return _legacy_sqlite
    _dev_sqlite.parent.mkdir(parents=True, exist_ok=True)
    return _dev_sqlite


_default_sqlite = _pick_default_sqlite()


def _effective_database_url() -> str:
    """Итоговый URL БД: SQLite только из каталога crm-b2b-equipment, если не задан другой сервер (PostgreSQL и т.д.)."""
    default = f"sqlite:///{_pick_default_sqlite().as_posix()}"
    raw = (
        os.getenv("CRM_B2B_DATABASE_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )
    if not raw:
        return default

    try:
        url = make_url(raw)
    except Exception:
        return raw

    if url.drivername != "sqlite":
        return raw

    db = url.database or ""
    if not db:
        return default

    path = Path(db)
    if not path.is_absolute():
        path = (_repo_root / path).resolve()
    else:
        path = path.resolve()

    try:
        path.relative_to(_repo_root.resolve())
    except ValueError:
        src = (
            "CRM_B2B_DATABASE_URL"
            if os.getenv("CRM_B2B_DATABASE_URL", "").strip()
            else "DATABASE_URL"
        )
        warnings.warn(
            f"{src} указывает на SQLite вне каталога этого CRM ({path}); "
            f"игнорируем и используем базу проекта: {_default_sqlite}",
            UserWarning,
            stacklevel=2,
        )
        return default

    return f"sqlite:///{path.as_posix()}"


DATABASE_URL = _effective_database_url()

_connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
