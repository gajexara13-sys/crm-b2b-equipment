"""Добавление колонок в SQLite при обновлении моделей (create_all их не меняет)."""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.database import engine


def _add_columns(table: str, column_sql: list[tuple[str, str]]) -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns(table)}
    alters = [sql for col, sql in column_sql if col not in existing]
    if not alters:
        return
    with engine.begin() as conn:
        for sql in alters:
            conn.execute(text(sql))


def run_sqlite_migrations() -> None:
    if not str(engine.url).startswith("sqlite"):
        return

    _add_columns(
        "material_norms",
        [("category_label", 'ALTER TABLE material_norms ADD COLUMN category_label TEXT DEFAULT ""')],
    )

    _add_columns(
        "requests",
        [
            ("material_category_id", "ALTER TABLE requests ADD COLUMN material_category_id INTEGER"),
            ("material_test_object_id", "ALTER TABLE requests ADD COLUMN material_test_object_id INTEGER"),
            ("material_variant", "ALTER TABLE requests ADD COLUMN material_variant TEXT"),
            ("selected_price_position_ids_json", "ALTER TABLE requests ADD COLUMN selected_price_position_ids_json TEXT"),
            ("selected_indicator_ids_json", "ALTER TABLE requests ADD COLUMN selected_indicator_ids_json TEXT"),
            ("contact_name", "ALTER TABLE requests ADD COLUMN contact_name TEXT"),
            ("source", "ALTER TABLE requests ADD COLUMN source TEXT"),
        ],
    )

    _add_columns(
        "products",
        [
            ("tech_specs", "ALTER TABLE products ADD COLUMN tech_specs TEXT"),
            ("warranty_terms", "ALTER TABLE products ADD COLUMN warranty_terms TEXT"),
            ("delivery_terms", "ALTER TABLE products ADD COLUMN delivery_terms TEXT"),
            ("cost_with_vat", "ALTER TABLE products ADD COLUMN cost_with_vat REAL DEFAULT 0"),
            ("price_dealers_vat", "ALTER TABLE products ADD COLUMN price_dealers_vat REAL DEFAULT 0"),
            ("price_end_vat", "ALTER TABLE products ADD COLUMN price_end_vat REAL DEFAULT 0"),
            ("weight_net_kg", "ALTER TABLE products ADD COLUMN weight_net_kg REAL"),
            ("weight_gross_kg", "ALTER TABLE products ADD COLUMN weight_gross_kg REAL"),
            ("volume_m3", "ALTER TABLE products ADD COLUMN volume_m3 REAL"),
            ("length_cm", "ALTER TABLE products ADD COLUMN length_cm REAL"),
            ("width_cm", "ALTER TABLE products ADD COLUMN width_cm REAL"),
            ("height_cm", "ALTER TABLE products ADD COLUMN height_cm REAL"),
            ("related_product_ids_json", "ALTER TABLE products ADD COLUMN related_product_ids_json TEXT"),
            ("analog_product_ids_json", "ALTER TABLE products ADD COLUMN analog_product_ids_json TEXT"),
            ("stock_quantity", "ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0"),
            ("brand", "ALTER TABLE products ADD COLUMN brand TEXT"),
            ("product_status", 'ALTER TABLE products ADD COLUMN product_status TEXT DEFAULT "draft"'),
            ("equipment_type", "ALTER TABLE products ADD COLUMN equipment_type TEXT"),
            ("website_url", "ALTER TABLE products ADD COLUMN website_url TEXT"),
            ("photo_urls_json", "ALTER TABLE products ADD COLUMN photo_urls_json TEXT"),
        ],
    )

    _add_columns(
        "commercial_quotes",
        [
            ("terms_price_validity", "ALTER TABLE commercial_quotes ADD COLUMN terms_price_validity TEXT"),
            ("terms_lead_time", "ALTER TABLE commercial_quotes ADD COLUMN terms_lead_time TEXT"),
            ("request_id", "ALTER TABLE commercial_quotes ADD COLUMN request_id INTEGER REFERENCES requests(id)"),
            ("quote_kind", "ALTER TABLE commercial_quotes ADD COLUMN quote_kind TEXT DEFAULT 'product'"),
        ],
    )

    _add_columns(
        "commercial_quote_items",
        [
            ("service_item_id", "ALTER TABLE commercial_quote_items ADD COLUMN service_item_id INTEGER"),
            ("item_kind",       "ALTER TABLE commercial_quote_items ADD COLUMN item_kind TEXT DEFAULT 'product'"),
        ],
    )

    _add_columns(
        "quote_sender_profiles",
        [
            ("intro_template",  "ALTER TABLE quote_sender_profiles ADD COLUMN intro_template TEXT"),
            ("logo_url",        "ALTER TABLE quote_sender_profiles ADD COLUMN logo_url TEXT"),
            ("signature_url",   "ALTER TABLE quote_sender_profiles ADD COLUMN signature_url TEXT"),
            ("stamp_url",       "ALTER TABLE quote_sender_profiles ADD COLUMN stamp_url TEXT"),
        ],
    )

    _add_columns(
        "clients",
        [
            ("contact_position", "ALTER TABLE clients ADD COLUMN contact_position TEXT"),
        ],
    )

    _add_columns(
        "samples",
        [
            ("material_norm_id", "ALTER TABLE samples ADD COLUMN material_norm_id INTEGER"),
            ("primary_nd_json", "ALTER TABLE samples ADD COLUMN primary_nd_json TEXT"),
            ("additional_nd_json", "ALTER TABLE samples ADD COLUMN additional_nd_json TEXT"),
            ("methodology_catalog_json", "ALTER TABLE samples ADD COLUMN methodology_catalog_json TEXT"),
            ("selected_price_position_ids_json", "ALTER TABLE samples ADD COLUMN selected_price_position_ids_json TEXT"),
            ("selected_indicator_ids_json", "ALTER TABLE samples ADD COLUMN selected_indicator_ids_json TEXT"),
            ("material_category_id", "ALTER TABLE samples ADD COLUMN material_category_id INTEGER"),
            ("material_test_object_id", "ALTER TABLE samples ADD COLUMN material_test_object_id INTEGER"),
            ("material_variant", "ALTER TABLE samples ADD COLUMN material_variant TEXT"),
        ],
    )

    _seed_service_catalog()
    _seed_product_catalog()
    _add_asphalt_subcats()


def _seed_service_catalog() -> None:
    """Заполняет категории и подкатегории каталога услуг, если они ещё не созданы."""
    insp = inspect(engine)
    if "service_categories" not in insp.get_table_names():
        return

    SEED = [
        {
            "name": "Метрологические услуги",
            "sort_order": 1,
            "subcategories": [
                "Поверка",
                "Калибровка",
                "Аттестация",
                "Контроль метрологических характеристик",
            ],
        },
        {
            "name": "Обучение",
            "sort_order": 2,
            "subcategories": [
                "Дополнительное профессиональное образование",
                "Профессиональное обучение",
            ],
        },
        {
            "name": "Ремонт оборудования",
            "sort_order": 3,
            "subcategories": [
                "Прессы",
                "Компакторы",
                "Колейные установки",
                "Асфальтоанализаторы",
                "Камеры климатические",
                "Сушильные шкафы",
                "Термостаты",
                "Виброустановки",
                "Вакуумные установки",
                "Установки вращающиеся",
                "Миксеры",
                "Битумные приборы",
            ],
        },
    ]

    with engine.begin() as conn:
        existing = conn.execute(text("SELECT COUNT(*) FROM service_categories")).scalar()
        if existing and existing > 0:
            return
        for cat in SEED:
            result = conn.execute(
                text("INSERT INTO service_categories (name, sort_order) VALUES (:n, :s)"),
                {"n": cat["name"], "s": cat["sort_order"]},
            )
            cat_id = result.lastrowid
            for i, sub in enumerate(cat["subcategories"]):
                conn.execute(
                    text("INSERT INTO service_subcategories (category_id, name, sort_order) VALUES (:c, :n, :s)"),
                    {"c": cat_id, "n": sub, "s": i},
                )


def _seed_product_catalog() -> None:
    """Преобразует product_categories в иерархию и распределяет товары по новым подкатегориям.

    Запускается один раз — определяется по наличию категории «Асфальтобетоны» с parent_id IS NULL.
    """
    insp = inspect(engine)
    if "product_categories" not in insp.get_table_names():
        return

    # 1) Добавляем колонки parent_id и sort_order, если их нет
    cols = {c["name"] for c in insp.get_columns("product_categories")}
    with engine.begin() as conn:
        if "parent_id" not in cols:
            conn.execute(text("ALTER TABLE product_categories ADD COLUMN parent_id INTEGER"))
        if "sort_order" not in cols:
            conn.execute(text("ALTER TABLE product_categories ADD COLUMN sort_order INTEGER DEFAULT 0"))

    # 2) Если уже заполнено (есть хоть одна подкатегория) — выходим
    with engine.begin() as conn:
        seeded = conn.execute(
            text("SELECT id FROM product_categories WHERE parent_id IS NOT NULL LIMIT 1")
        ).first()
        if seeded:
            return

    NEW_TREE = [
        ("Асфальтобетоны", ["Компакторы", "Асфальтоанализаторы", "Колейные установки", "Вакуумные установки", "Миксеры"]),
        ("Бетоны и растворы", ["Прессы", "Установки ВНП", "Морозильные камеры", "Входной контроль смеси", "Формы", "Виброплощадки"]),
        ("Битумные материалы", ["Приборы БНД, ПБВ", "Приборы БВ PG", "Приборы ЭБК, ЭБА", "Приборы БМ"]),
        ("Каменные заполнители", ["Сита лабораторные", "Шаблоны", "Барабанные установки", "Формы", "Фильтрация", "Superpave", "Разное"]),
        ("Цементные вяжущие", ["Испытание сухого цемента", "Изготовление образцов", "Испытание бетонных образцов"]),
        ("Минеральные порошки", ["Испытания по ГОСТ", "Испытания Superpave"]),
        ("Укрепленные грунты", ["Изготовление образцов", "Испытания образцов"]),
        ("Грунты и почвы", ["Пластичность", "Сита лабораторные", "Компакторы", "Ареометры"]),
        ("Полевые испытания", ["Контроль плотности", "Деформативность", "Ровность", "Геометрия", "Прочность бетона", "Толщиномеры", "Адгезиметры", "Дефектоскопы", "Геодезия"]),
        ("Общелаб", ["Сушильные шкафы", "Климатические камеры", "Печи нагревательные", "Сита лабораторные", "Линейки и штангенциркули", "Стекло", "Совки, кельмы, лопатки", "Разное"]),
    ]

    # Распределение существующих товаров. Если ID не в маппинге — попадёт в «Общелаб > Разное».
    PRODUCT_MAP = {
        # Асфальтобетоны
        4: ("Асфальтобетоны", "Миксеры"),
        5: ("Асфальтобетоны", "Миксеры"),
        6: ("Асфальтобетоны", "Миксеры"),
        7: ("Асфальтобетоны", "Компакторы"),
        8: ("Асфальтобетоны", "Асфальтоанализаторы"),
        9: ("Асфальтобетоны", "Асфальтоанализаторы"),
        10: ("Асфальтобетоны", "Компакторы"),
        11: ("Асфальтобетоны", "Компакторы"),
        12: ("Асфальтобетоны", "Компакторы"),
        13: ("Асфальтобетоны", "Колейные установки"),
        14: ("Полевые испытания", "Контроль плотности"),
        15: ("Асфальтобетоны", "Компакторы"),
        16: ("Асфальтобетоны", "Компакторы"),
        17: ("Асфальтобетоны", "Колейные установки"),
        18: ("Асфальтобетоны", "Колейные установки"),
        19: ("Асфальтобетоны", "Колейные установки"),
        20: ("Асфальтобетоны", "Компакторы"),
        21: ("Асфальтобетоны", "Колейные установки"),
        22: ("Асфальтобетоны", "Колейные установки"),
        23: ("Асфальтобетоны", "Компакторы"),
        24: ("Асфальтобетоны", "Колейные установки"),
        25: ("Асфальтобетоны", "Асфальтоанализаторы"),
        26: ("Асфальтобетоны", "Компакторы"),
        27: ("Асфальтобетоны", "Компакторы"),
        28: ("Асфальтобетоны", "Компакторы"),
        29: ("Асфальтобетоны", "Компакторы"),
        30: ("Асфальтобетоны", "Компакторы"),
        31: ("Асфальтобетоны", "Компакторы"),
        32: ("Асфальтобетоны", "Компакторы"),
        33: ("Асфальтобетоны", "Компакторы"),
        34: ("Асфальтобетоны", "Компакторы"),
        35: ("Асфальтобетоны", "Колейные установки"),
        36: ("Асфальтобетоны", "Компакторы"),
        37: ("Асфальтобетоны", "Компакторы"),
        38: ("Асфальтобетоны", "Компакторы"),
        39: ("Асфальтобетоны", "Колейные установки"),
        40: ("Асфальтобетоны", "Колейные установки"),
        41: ("Асфальтобетоны", "Колейные установки"),
        42: ("Асфальтобетоны", "Колейные установки"),
        43: ("Асфальтобетоны", "Колейные установки"),
        44: ("Асфальтобетоны", "Колейные установки"),
        45: ("Асфальтобетоны", "Колейные установки"),
        46: ("Полевые испытания", "Контроль плотности"),
        # Каменные заполнители
        66: ("Каменные заполнители", "Superpave"),
        67: ("Каменные заполнители", "Барабанные установки"),
        68: ("Каменные заполнители", "Разное"),
        69: ("Каменные заполнители", "Superpave"),
        70: ("Каменные заполнители", "Барабанные установки"),
        71: ("Каменные заполнители", "Сита лабораторные"),
        72: ("Каменные заполнители", "Superpave"),
        73: ("Каменные заполнители", "Superpave"),
        74: ("Каменные заполнители", "Шаблоны"),
        # Битумные материалы
        47: ("Битумные материалы", "Приборы БВ PG"),
        48: ("Битумные материалы", "Приборы БНД, ПБВ"),
        49: ("Битумные материалы", "Приборы БНД, ПБВ"),
        50: ("Битумные материалы", "Приборы БНД, ПБВ"),
        51: ("Битумные материалы", "Приборы БВ PG"),
        52: ("Битумные материалы", "Приборы БВ PG"),
        53: ("Битумные материалы", "Приборы БНД, ПБВ"),
        54: ("Битумные материалы", "Приборы БВ PG"),
        55: ("Битумные материалы", "Приборы БНД, ПБВ"),
        56: ("Битумные материалы", "Приборы БНД, ПБВ"),
        57: ("Битумные материалы", "Приборы БВ PG"),
        58: ("Битумные материалы", "Приборы ЭБК, ЭБА"),
        59: ("Битумные материалы", "Приборы БВ PG"),
        60: ("Битумные материалы", "Приборы БНД, ПБВ"),
        61: ("Битумные материалы", "Приборы ЭБК, ЭБА"),
        62: ("Битумные материалы", "Приборы БНД, ПБВ"),
        63: ("Битумные материалы", "Приборы БВ PG"),
        64: ("Битумные материалы", "Приборы БВ PG"),
        65: ("Битумные материалы", "Приборы БНД, ПБВ"),
        # Бетоны и растворы
        75: ("Бетоны и растворы", "Прессы"),
        76: ("Бетоны и растворы", "Установки ВНП"),
        # Грунты и почвы / Полевые испытания
        78: ("Полевые испытания", "Контроль плотности"),
        79: ("Грунты и почвы", "Пластичность"),
        80: ("Полевые испытания", "Контроль плотности"),
        81: ("Полевые испытания", "Ровность"),
        82: ("Полевые испытания", "Деформативность"),
        # Общелаб + перенесённые в Асфальтобетоны
        83: ("Асфальтобетоны", "Асфальтоанализаторы"),
        84: ("Общелаб", "Разное"),
        85: ("Общелаб", "Разное"),
        86: ("Общелаб", "Разное"),
        87: ("Общелаб", "Климатические камеры"),
        88: ("Общелаб", "Разное"),
        89: ("Асфальтобетоны", "Вакуумные установки"),
        90: ("Общелаб", "Разное"),
        91: ("Общелаб", "Разное"),
        92: ("Общелаб", "Сушильные шкафы"),
        93: ("Общелаб", "Сушильные шкафы"),
        94: ("Общелаб", "Сушильные шкафы"),
        95: ("Общелаб", "Сушильные шкафы"),
        96: ("Общелаб", "Сушильные шкафы"),
        97: ("Общелаб", "Сушильные шкафы"),
        98: ("Общелаб", "Сушильные шкафы"),
        99: ("Общелаб", "Сушильные шкафы"),
        100: ("Общелаб", "Сушильные шкафы"),
        101: ("Общелаб", "Сушильные шкафы"),
        102: ("Общелаб", "Сушильные шкафы"),
        103: ("Общелаб", "Сушильные шкафы"),
        104: ("Общелаб", "Сушильные шкафы"),
        105: ("Общелаб", "Печи нагревательные"),
        106: ("Общелаб", "Печи нагревательные"),
        107: ("Общелаб", "Печи нагревательные"),
        108: ("Общелаб", "Печи нагревательные"),
        109: ("Общелаб", "Печи нагревательные"),
        110: ("Общелаб", "Печи нагревательные"),
        111: ("Общелаб", "Печи нагревательные"),
        112: ("Общелаб", "Печи нагревательные"),
        113: ("Общелаб", "Разное"),
        114: ("Общелаб", "Климатические камеры"),
        115: ("Общелаб", "Климатические камеры"),
        116: ("Общелаб", "Разное"),
        117: ("Общелаб", "Разное"),
        118: ("Общелаб", "Сушильные шкафы"),
        119: ("Общелаб", "Сушильные шкафы"),
        120: ("Общелаб", "Сушильные шкафы"),
        121: ("Общелаб", "Сушильные шкафы"),
        122: ("Общелаб", "Сушильные шкафы"),
        123: ("Общелаб", "Сушильные шкафы"),
        124: ("Общелаб", "Сушильные шкафы"),
        125: ("Общелаб", "Сушильные шкафы"),
        126: ("Общелаб", "Сушильные шкафы"),
        127: ("Общелаб", "Разное"),
        128: ("Общелаб", "Разное"),
        129: ("Асфальтобетоны", "Асфальтоанализаторы"),
        130: ("Общелаб", "Сушильные шкафы"),
        # Цементные
        77: ("Цементные вяжущие", "Испытание сухого цемента"),
    }

    with engine.begin() as conn:
        # Запоминаем старые верхнеуровневые категории, чтобы потом удалить пустые
        old_top_ids = [
            row[0] for row in conn.execute(text("SELECT id FROM product_categories WHERE parent_id IS NULL")).all()
        ]

        # Создаём новое дерево
        sub_ids = {}  # (cat_name, sub_name) -> subcategory_id
        for ci, (cat_name, subs) in enumerate(NEW_TREE):
            code = f"cat_new_{ci+1}"
            r = conn.execute(
                text("INSERT INTO product_categories (code, name, parent_id, sort_order) VALUES (:c, :n, NULL, :s)"),
                {"c": code, "n": cat_name, "s": ci + 1},
            )
            cat_id = r.lastrowid
            for si, sub in enumerate(subs):
                sr = conn.execute(
                    text("INSERT INTO product_categories (code, name, parent_id, sort_order) VALUES (:c, :n, :p, :s)"),
                    {"c": f"{code}_sub_{si+1}", "n": sub, "p": cat_id, "s": si + 1},
                )
                sub_ids[(cat_name, sub)] = sr.lastrowid

        fallback = sub_ids[("Общелаб", "Разное")]

        # Распределяем заданные товары
        for prod_id, (cat_n, sub_n) in PRODUCT_MAP.items():
            target = sub_ids.get((cat_n, sub_n), fallback)
            conn.execute(
                text("UPDATE products SET category_id = :cid WHERE id = :pid"),
                {"cid": target, "pid": prod_id},
            )

        # Любые товары, всё ещё привязанные к старым категориям, переносим в фолбэк
        if old_top_ids:
            placeholders = ",".join(f":o{i}" for i in range(len(old_top_ids)))
            params = {f"o{i}": v for i, v in enumerate(old_top_ids)}
            params["fb"] = fallback
            conn.execute(
                text(f"UPDATE products SET category_id = :fb WHERE category_id IN ({placeholders})"),
                params,
            )
            # Удаляем старые категории (теперь они пустые)
            for old_id in old_top_ids:
                conn.execute(text("DELETE FROM product_categories WHERE id = :id"), {"id": old_id})


def _add_asphalt_subcats() -> None:
    """Добавляет подкатегории «Испытательные машины» и «Установки сжатия» в «Асфальтобетоны»."""
    insp = inspect(engine)
    if "product_categories" not in insp.get_table_names():
        return

    with engine.begin() as conn:
        # Sentinel: уже создано?
        existing = conn.execute(
            text("SELECT id FROM product_categories WHERE name = 'Испытательные машины' LIMIT 1")
        ).first()
        if existing:
            return

        # Найти id категории Асфальтобетоны (верхний уровень)
        row = conn.execute(
            text("SELECT id FROM product_categories WHERE name = 'Асфальтобетоны' AND parent_id IS NULL LIMIT 1")
        ).first()
        if not row:
            return
        asphalt_id = row[0]

        # Текущий максимальный sort_order среди подкатегорий Асфальтобетоны
        max_order = conn.execute(
            text("SELECT COALESCE(MAX(sort_order), 0) FROM product_categories WHERE parent_id = :pid"),
            {"pid": asphalt_id},
        ).scalar()

        # Создать «Испытательные машины»
        r1 = conn.execute(
            text("INSERT INTO product_categories (code, name, parent_id, sort_order) VALUES (:c, :n, :p, :s)"),
            {"c": "cat_new_1_sub_im", "n": "Испытательные машины", "p": asphalt_id, "s": max_order + 1},
        )
        im_id = r1.lastrowid

        # Создать «Установки сжатия»
        r2 = conn.execute(
            text("INSERT INTO product_categories (code, name, parent_id, sort_order) VALUES (:c, :n, :p, :s)"),
            {"c": "cat_new_1_sub_uz", "n": "Установки сжатия", "p": asphalt_id, "s": max_order + 2},
        )
        uz_id = r2.lastrowid

        # Переместить товары в «Испытательные машины»
        for pid in [44, 39, 35, 24, 22, 21, 19, 18, 17]:
            conn.execute(
                text("UPDATE products SET category_id = :cid WHERE id = :pid"),
                {"cid": im_id, "pid": pid},
            )

        # Переместить товары в «Установки сжатия» (тестеры на стабильность Marshall)
        for pid in [26, 27, 28, 29, 30, 31, 32, 33, 34]:
            conn.execute(
                text("UPDATE products SET category_id = :cid WHERE id = :pid"),
                {"cid": uz_id, "pid": pid},
            )
