#!/usr/bin/env python3
"""
Конвертирует пользовательский .dotx-шаблон КП в docxtpl-готовый .docx.

Запуск из корня репозитория:
    python backend/tools/make_kp_template.py

Выходной файл: backend/templates/kp_rutesttpl.docx
Для активации установи переменную окружения:
    QUOTE_DOCX_TEMPLATE_PATH=templates/kp_rutesttpl.docx
или в .env (относительно backend/).
"""

import sys
import zipfile
from copy import deepcopy
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

SRC_DOTX = Path(r"C:\Users\user\Documents\Настраиваемые шаблоны Office\КП от ООО РУТЕСТ.dotx")
OUT_DOCX = Path(__file__).resolve().parent.parent / "templates" / "kp_rutesttpl.docx"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"


def qw(name: str) -> str:
    return f"{{{W}}}{name}"


# ─── XML helpers ──────────────────────────────────────────────────────────────

def _get_rPr(para_elem):
    for r in para_elem.findall(qw("r")):
        rpr = r.find(qw("rPr"))
        if rpr is not None:
            return deepcopy(rpr)
    return None


def _clear_para_content(para_elem):
    keep = {qw("pPr")}
    for child in list(para_elem):
        if child.tag not in keep:
            para_elem.remove(child)


def _make_run(text: str, rPr=None):
    from docx.oxml import OxmlElement
    r = OxmlElement("w:r")
    if rPr is not None:
        r.append(deepcopy(rPr))
    t = OxmlElement("w:t")
    t.set(XML_SPACE, "preserve")
    t.text = text
    r.append(t)
    return r


def set_cell_text(cell, text: str):
    """Replace first paragraph of a table cell with a single run (preserves formatting)."""
    tc = cell._tc
    paras = tc.findall(qw("p"))
    if not paras:
        from lxml import etree
        p = etree.SubElement(tc, qw("p"))
        paras = [p]
    para = paras[0]
    rPr = _get_rPr(para)
    _clear_para_content(para)
    run = _make_run(text, rPr)
    para.append(run)
    for extra in paras[1:]:
        tc.remove(extra)


# ─── Row helpers ──────────────────────────────────────────────────────────────

def tbl_rows(tbl):
    return tbl._tbl.findall(qw("tr"))


def insert_row_after(tbl, row_idx: int, new_tr):
    rows = tbl_rows(tbl)
    ref = rows[row_idx]
    ref.addnext(new_tr)


def delete_rows(tbl, start: int, end: int):
    rows = tbl_rows(tbl)
    for tr in rows[start:end + 1]:
        tbl._tbl.remove(tr)


def make_loop_row(tag_text: str):
    """Create a minimal single-cell row containing tag_text."""
    from docx.oxml import OxmlElement
    tr = OxmlElement("w:tr")
    tc = OxmlElement("w:tc")
    tcPr = OxmlElement("w:tcPr")
    tcW = OxmlElement("w:tcW")
    tcW.set(qw("w"), "0")
    tcW.set(qw("type"), "auto")
    tcPr.append(tcW)
    tc.append(tcPr)
    p = OxmlElement("w:p")
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.set(XML_SPACE, "preserve")
    t.text = tag_text
    r.append(t)
    p.append(r)
    tc.append(p)
    tr.append(tc)
    return tr


# ─── Main conversion ──────────────────────────────────────────────────────────

def convert():
    import tempfile, os
    from docx import Document

    # 1. Patch dotx → docx content type
    tmp = Path(tempfile.mktemp(suffix=".docx"))
    with zipfile.ZipFile(SRC_DOTX, "r") as zin:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "[Content_Types].xml":
                    data = data.replace(
                        b"wordprocessingml.template.main+xml",
                        b"wordprocessingml.document.main+xml",
                    )
                zout.writestr(item, data)

    doc = Document(str(tmp))
    os.unlink(tmp)

    tbl = doc.tables[0]
    print(f"Таблица загружена, строк: {len(tbl.rows)}")

    def find_row_idx(keyword: str, start: int = 0) -> int:
        """Find first row where ANY cell contains keyword."""
        for i, row in enumerate(tbl.rows[start:], start=start):
            seen = set()
            for cell in row.cells:
                t = cell.text
                if t in seen:
                    continue
                seen.add(t)
                if keyword in t:
                    return i
        return -1

    def row_text(row_idx: int) -> str:
        seen = set()
        parts = []
        for cell in tbl.rows[row_idx].cells:
            t = cell.text.strip()
            if t and t not in seen:
                seen.add(t)
                parts.append(t)
        return " | ".join(parts)

    # ── 2. Заголовок документа ────────────────────────────────────────────────
    # r0: правая часть = получатель
    set_cell_text(tbl.rows[0].cells[3], "{{ recipient_text }}")
    # r2: левая часть = отправитель
    set_cell_text(tbl.rows[2].cells[0], "{{ sender_text }}")
    # r4: дата
    set_cell_text(tbl.rows[4].cells[0], "{{ quote_date_ru }}")

    # r5: "Коммерческое предложение" + номер КП
    tc5 = tbl.rows[5].cells[0]._tc
    paras5 = tc5.findall(qw("p"))
    if paras5:
        from docx.oxml import OxmlElement
        p_num = OxmlElement("w:p")
        r_num = OxmlElement("w:r")
        t_num = OxmlElement("w:t")
        t_num.set(XML_SPACE, "preserve")
        t_num.text = "{% if quote_number %}№ {{ quote_number }}{% endif %}"
        r_num.append(t_num)
        p_num.append(r_num)
        tc5.append(p_num)

    # r8: приветствие
    set_cell_text(tbl.rows[8].cells[0],
        "{% if greeting_name %}Уважаемый {{ greeting_name }}!"
        "{% else %}Уважаемый заказчик!{% endif %}")

    # r10: вводный текст КП
    set_cell_text(tbl.rows[10].cells[0],
        "{% if intro %}{{ intro_listing }}{% endif %}")

    # ── 3. Блок товара ─────────────────────────────────────────────────────────
    # Оригинальный шаблон: Товар 1 r12–r34, Товар 2 r36–r59, Товар 3 r60–r83

    # 3a. {%tr for item in items %} перед r12
    for_item_row = make_loop_row("{%tr for item in items %}")
    insert_row_after(tbl, 11, for_item_row)
    # После вставки все индексы сдвигаются на +1

    # 3b. Название товара (было r12, стало r13)
    ti = find_row_idx("Асфальтоанализатор HYRS-6", 0)
    print(f"  title row: {ti}  → {row_text(ti)[:50]}")
    set_cell_text(tbl.rows[ti].cells[0], "{{ item.title }}")

    # 3c. Описание товара (ti+2: через пустую строку)
    di = ti + 2
    print(f"  descr row: {di}  → {row_text(di)[:50]}")
    set_cell_text(tbl.rows[di].cells[0],
        "{% if item.show_intro and item.intro %}{{ item.intro_listing }}{% endif %}")

    # 3d. Особенности / features — в строке между описанием и комплектом (di+1)
    fi = di + 1
    print(f"  feats row: {fi}  → {row_text(fi)[:50]}")
    set_cell_text(tbl.rows[fi].cells[0],
        "{% if item.show_features and item.features_block %}"
        "{{ item.features_block }}"
        "{% endif %}")

    # 3e. Комплект поставки
    ki = find_row_idx("Комплект поставки", ti)
    print(f"  kit   row: {ki}  → {row_text(ki)[:50]}")
    set_cell_text(tbl.rows[ki].cells[0],
        "{% if item.show_kit and item.kit_text %}"
        "Комплект поставки:{{ item.kit_listing }}"
        "{% endif %}")

    # 3f. "Технические характеристики" — условная метка (показываем только если есть specs)
    tech_i = find_row_idx("Технические характеристики", ti)
    if tech_i >= 0:
        print(f"  tech  row: {tech_i}  → {row_text(tech_i)[:50]}")
        set_cell_text(tbl.rows[tech_i].cells[0],
            "{% if item.show_specs and item.specs %}"
            "Технические характеристики"
            "{% endif %}")

    # 3g. Строки характеристик → {%tr for spec in item.specs %}
    spec_start = find_row_idx("Тип нагрева", ti)
    spec_end = spec_start
    while spec_end + 1 < len(tbl.rows):
        next_text = "".join(c.text.strip() for c in tbl.rows[spec_end + 1].cells)
        if not next_text:
            break
        spec_end += 1
    print(f"  spec rows: {spec_start}..{spec_end}")

    set_cell_text(tbl.rows[spec_start].cells[0], "{%tr for spec in item.specs %}")
    right_col = 3
    set_cell_text(tbl.rows[spec_start + 1].cells[0], "{{ spec.param }}")
    set_cell_text(tbl.rows[spec_start + 1].cells[right_col], "{{ spec.value }}")

    endfor_spec = make_loop_row("{%tr endfor %}")
    insert_row_after(tbl, spec_start + 1, endfor_spec)

    del_start = spec_start + 3
    del_end = spec_end + 1
    if del_end >= del_start:
        delete_rows(tbl, del_start, del_end)
        print(f"  удалено spec строк: {del_end - del_start + 1}")

    # 3h. Подпись к рисунку и фото
    fig_i = find_row_idx("Рис.1.", 0)
    if fig_i >= 0:
        print(f"  fig   row: {fig_i}  → {row_text(fig_i)[:50]}")
        set_cell_text(tbl.rows[fig_i].cells[0],
            "{% if item.show_photos %}{{ item.figure_caption }}{% endif %}")
        if fig_i + 1 < len(tbl.rows):
            set_cell_text(tbl.rows[fig_i + 1].cells[0],
                "{% if item.show_photos %}{{ item.photo }}{% endif %}")

    # 3i. {%tr endfor %} после последней строки блока товара
    block_end_idx = fig_i + 2
    endfor_item = make_loop_row("{%tr endfor %}")
    if block_end_idx < len(tbl.rows):
        insert_row_after(tbl, block_end_idx, endfor_item)
    else:
        tbl._tbl.append(endfor_item)
    print(f"  endfor товара вставлен после r{block_end_idx}")

    # 3j. Удаляем блоки Товар 2 и Товар 3
    prod2_start = find_row_idx("Установка для определения", 0)
    spec_section = find_row_idx("Спецификация на поставку", 0)
    prod_blocks_end = spec_section - 2
    if prod2_start > 0 and prod_blocks_end >= prod2_start:
        delete_rows(tbl, prod2_start, prod_blocks_end)
        print(f"  удалены блоки товаров 2-3: {prod2_start}..{prod_blocks_end}")

    # ── 4. Таблица спецификации ────────────────────────────────────────────────
    spec_section_idx = find_row_idx("Спецификация на поставку", 0)
    header_row_idx = find_row_idx("№ п/п", spec_section_idx)
    print(f"  spec table header: r{header_row_idx}  → {row_text(header_row_idx)[:60]}")

    # Вставляем {%tr for r in spec_rows %} после заголовка
    for_spec = make_loop_row("{%tr for r in spec_rows %}")
    insert_row_after(tbl, header_row_idx, for_spec)
    data_row_idx = header_row_idx + 2

    dr = tbl.rows[data_row_idx]
    print(f"  data row: r{data_row_idx}  → {row_text(data_row_idx)[:60]}")
    set_cell_text(dr.cells[0], "{{ r.no }}")
    set_cell_text(dr.cells[1], "{{ r.name }}")
    set_cell_text(dr.cells[2], "{{ r.qty }}")
    set_cell_text(dr.cells[4], "{{ r.price }}")
    set_cell_text(dr.cells[6], "{{ r.sum_full }}")

    # Вставляем {%tr endfor %} после строки данных
    endfor_spec_sec = make_loop_row("{%tr endfor %}")
    insert_row_after(tbl, data_row_idx, endfor_spec_sec)

    # Удаляем лишние строки данных (старые товары 2 и 3)
    itogo_idx = find_row_idx("ИТОГО", data_row_idx + 2)
    print(f"  ИТОГО row: {itogo_idx}")
    extra_start = data_row_idx + 2
    extra_end = itogo_idx - 1
    if itogo_idx > 0 and extra_end >= extra_start:
        delete_rows(tbl, extra_start, extra_end)
        print(f"  удалены лишние строки спецификации: {extra_start}..{extra_end}")
        itogo_idx = find_row_idx("ИТОГО", data_row_idx + 2)
        print(f"  ИТОГО row после удаления: {itogo_idx}")

    # ИТОГО
    if itogo_idx >= 0:
        set_cell_text(tbl.rows[itogo_idx].cells[6], "{{ sum_total_full }}")
        print(f"  ИТОГО c6 → sum_total_full")

    # НДС
    nds_idx = find_row_idx("НДС", itogo_idx + 1 if itogo_idx >= 0 else 0)
    if nds_idx >= 0:
        print(f"  НДС row: {nds_idx}")
        set_cell_text(tbl.rows[nds_idx].cells[1],
            "{% if vat_rate %}В т.ч. НДС {{ vat_rate }}%{% endif %}")
        set_cell_text(tbl.rows[nds_idx].cells[6],
            "{% if vat_rate %}{{ vat_amount }}{% endif %}")

    # ── 5. Условия поставки ────────────────────────────────────────────────────
    t_map = {
        "Цена действительна": "{% if terms_price_validity %}{{ terms_price_validity }}{% endif %}",
        "Условия поставки:":  "{% if terms_delivery %}Условия поставки: {{ terms_delivery }}{% endif %}",
        "Срок поставки:":     "{% if terms_lead_time %}Срок поставки: {{ terms_lead_time }}{% endif %}",
        "Условия оплаты:":    "{% if terms_payment %}Условия оплаты: {{ terms_payment }}{% endif %}",
        "Цены указаны":       "{{ terms_currency_note }}",
    }
    for kw, tpl in t_map.items():
        idx = find_row_idx(kw, 0)
        if idx >= 0:
            set_cell_text(tbl.rows[idx].cells[0], tpl)
            print(f"  terms: r{idx} → {kw[:30]}")

    # ── 6. Подпись ────────────────────────────────────────────────────────────
    sig_map = {
        "Ахметов":          "{{ signer_name }}",
        "Генеральный директор": "{{ signer_position }}",
        "ООО «РУТЕСТ»":     "{{ sender.legal_form }} «{{ sender.legal_name }}»",
        "Тел.: +7(937)":    "Тел.: {{ signer_phone }}",
    }
    for kw, tpl in sig_map.items():
        idx = find_row_idx(kw, 0)
        if idx >= 0:
            set_cell_text(tbl.rows[idx].cells[0], tpl)
            print(f"  sign: r{idx} → {kw}")

    # ── 7. Сохраняем ─────────────────────────────────────────────────────────
    OUT_DOCX.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT_DOCX))
    print(f"\n✓ Шаблон сохранён: {OUT_DOCX}")
    print("  Установи в .env: QUOTE_DOCX_TEMPLATE_PATH=templates/kp_rutesttpl.docx")


if __name__ == "__main__":
    convert()
