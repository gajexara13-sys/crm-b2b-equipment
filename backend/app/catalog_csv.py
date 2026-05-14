"""
Импорт CSV «Область аккредитации» в структуре, согласованной с исходной таблицей Excel:

  Столбец 1 — виды материалов / объект испытаний. Объединённые в Excel ячейки
    заданы как один текст: несколько названий материала разделены переносами
    строк в одной ячейке. Дальше по файлу пустой первый столбец означает
    «те же материалы», что в блоке выше.
  Столбец 2 — наименования определяемых показателей.
  Столбец 3 — диапазон измерений (определений).
  Столбец 4 — обозначение НД, устанавливающего требования к методике испытаний.

Разделитель полей в файле — точка с запятой (;). Первая строка — заголовки;
строка с подписями «1;2;3;4» (номера колонок) пропускается.
"""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Iterator, NamedTuple


class CatalogRowIn(NamedTuple):
    material_object: str
    characteristic: str
    range_text: str
    standard_ref: str


def _norm_cell(s: str | None) -> str:
    if s is None:
        return ""
    return (s.replace("\r\n", "\n").replace("\r", "\n")).strip()


def iter_accreditation_rows_from_text(text: str) -> Iterator[CatalogRowIn]:
    if text.startswith("\ufeff"):
        text = text[1:]
    reader = csv.reader(io.StringIO(text), delimiter=";")

    current_material = ""
    for i, row in enumerate(reader):
        if i == 0:
            continue
        if not row or len(row) < 4:
            continue
        c0 = _norm_cell(row[0]) if len(row) > 0 else ""
        c1 = _norm_cell(row[1]) if len(row) > 1 else ""
        c2 = _norm_cell(row[2]) if len(row) > 2 else ""
        c3 = _norm_cell(row[3]) if len(row) > 3 else ""
        if c0 == "1" and c1 == "2" and c2 == "3" and c3 == "4":
            continue
        if c0:
            current_material = (row[0].replace("\r\n", "\n").replace("\r", "\n").strip()) if row[0] else c0
        if not current_material or not c1:
            continue
        yield CatalogRowIn(
            material_object=current_material,
            characteristic=c1,
            range_text=c2,
            standard_ref=c3,
        )


def iter_accreditation_rows(path: Path | str, encoding: str = "utf-8") -> Iterator[CatalogRowIn]:
    p = Path(path)
    text = p.read_text(encoding=encoding)
    return iter_accreditation_rows_from_text(text)
