"""
CSV: категория материала → объект испытаний → НД на материал → доп. НД.

  Столбец 1 — категория (при пустой ячейке используется категория предыдущей строки).
  Столбец 2 — объект испытаний (материал).
  Столбец 3 — НД, устанавливающие требования к характеристикам (несколько через перенос;
    в пробе выбирается ровно один — основной НД изготовления/продукта).
  Столбец 4 — НД с дополнительными требованиями (несколько через перенос; множественный выбор).

Разделитель «;», первая строка — заголовки, строка «1;2;3;4» пропускается.
Пустые строки без материала игнорируются.
"""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Iterator, NamedTuple


class MaterialNormRowIn(NamedTuple):
    category_label: str
    material_label: str
    primary_standards: list[str]
    additional_standards: list[str]


def _split_nd_cell(raw: str | None) -> list[str]:
    if raw is None or not str(raw).strip():
        return []
    t = str(raw).replace("\r\n", "\n").replace("\r", "\n")
    return [x.strip() for x in t.split("\n") if x.strip()]


def _norm_cell(raw: str | None) -> str:
    if raw is None:
        return ""
    return raw.replace("\r\n", "\n").replace("\r", "\n").strip()


def iter_material_norm_rows_from_text(text: str) -> Iterator[MaterialNormRowIn]:
    if text.startswith("\ufeff"):
        text = text[1:]
    reader = csv.reader(io.StringIO(text), delimiter=";")

    current_category = ""
    for i, row in enumerate(reader):
        if i == 0:
            continue
        if not row or len(row) < 3:
            continue
        cat_cell = _norm_cell(row[0]) if len(row) > 0 else ""
        mat_cell = _norm_cell(row[1]) if len(row) > 1 else ""
        pri_txt = row[2] if len(row) > 2 else ""
        add_txt = row[3] if len(row) > 3 else ""

        pri_head = _norm_cell(pri_txt)
        add_head = _norm_cell(add_txt)
        if cat_cell == "1" and mat_cell == "2" and pri_head == "3" and add_head == "4":
            continue

        if cat_cell:
            current_category = cat_cell
        if not mat_cell:
            continue

        yield MaterialNormRowIn(
            category_label=current_category or "Без категории",
            material_label=mat_cell,
            primary_standards=_split_nd_cell(pri_txt),
            additional_standards=_split_nd_cell(add_txt),
        )


def iter_material_norm_rows(path: Path | str, encoding: str = "utf-8") -> Iterator[MaterialNormRowIn]:
    p = Path(path)
    text = p.read_text(encoding=encoding)
    return iter_material_norm_rows_from_text(text)
