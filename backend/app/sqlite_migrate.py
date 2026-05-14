"""Добавление колонок в SQLite при обновлении моделей (create_all их не меняет)."""

from __future__ import annotations

from sqlalchemy import inspect, text

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
