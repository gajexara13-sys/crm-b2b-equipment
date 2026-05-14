"""Пути к файлам LIMS (шаблоны протоколов и т.д.)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Локальная Windows-машина разработчика; в Linux/Docker недопустим — см. protocol_templates_dir().
_DEFAULT_PROTOCOL_DIR_WINDOWS = r"C:\Users\user\Documents\Протоколы LIMS"
# Записываемый каталог внутри образа backend (можно заменить томом через PROTOCOL_TEMPLATES_DIR).
_DEFAULT_PROTOCOL_DIR_POSIX = "/app/protocol_templates"

# Имя файла из папки пользователя; дополняется по мере появления шаблонов.
PROTOCOL_TEMPLATE_FILENAMES: dict[str, str] = {
    "gost_58401": "protocol_abs_58401_template.xlsx",
}


def protocol_templates_dir() -> Path:
    raw = os.getenv("PROTOCOL_TEMPLATES_DIR", "").strip()
    if raw:
        return Path(raw)
    if sys.platform == "win32":
        return Path(_DEFAULT_PROTOCOL_DIR_WINDOWS)
    return Path(_DEFAULT_PROTOCOL_DIR_POSIX)


def protocol_template_path(test_type: str) -> Path | None:
    filename = PROTOCOL_TEMPLATE_FILENAMES.get(test_type)
    if not filename:
        return None
    return protocol_templates_dir() / filename


def protocol_template_available(test_type: str) -> bool:
    p = protocol_template_path(test_type)
    return p is not None and p.is_file()
