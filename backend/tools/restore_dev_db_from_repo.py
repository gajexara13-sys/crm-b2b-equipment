# -*- coding: utf-8 -*-
"""Восстанавливает data/dev.db из backend/crm.db и подмешивает товары из предыдущего dev.db.

Запуск из каталога backend:
  python tools/restore_dev_db_from_repo.py
"""
from __future__ import annotations

import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


def _merge_products_from_attached(conn: sqlite3.Connection, alias: str) -> int:
    before = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]

    conn.execute(
        f"""
        INSERT INTO products (
            category_id, sku, name, unit, description, tech_specs, warranty_terms, delivery_terms,
            cost_with_vat, price_dealers_vat, price_end_vat,
            weight_net_kg, weight_gross_kg, volume_m3, length_cm, width_cm, height_cm,
            related_product_ids_json, analog_product_ids_json, stock_quantity,
            brand, product_status, equipment_type, website_url, photo_urls_json,
            purchase_cost, logistics_cost, extra_cost, target_margin_pct, recommended_price, min_price,
            is_active, created_at
        )
        SELECT
            CASE
                WHEN lp.category_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM product_categories c WHERE c.id = lp.category_id
                ) THEN lp.category_id
                ELSE NULL
            END,
            lp.sku, lp.name, lp.unit, lp.description, lp.tech_specs, lp.warranty_terms, lp.delivery_terms,
            lp.cost_with_vat, lp.price_dealers_vat, lp.price_end_vat,
            lp.weight_net_kg, lp.weight_gross_kg, lp.volume_m3, lp.length_cm, lp.width_cm, lp.height_cm,
            lp.related_product_ids_json, lp.analog_product_ids_json, lp.stock_quantity,
            lp.brand, lp.product_status, lp.equipment_type, lp.website_url, lp.photo_urls_json,
            lp.purchase_cost, lp.logistics_cost, lp.extra_cost, lp.target_margin_pct, lp.recommended_price, lp.min_price,
            lp.is_active, CURRENT_TIMESTAMP
        FROM {alias}.products lp
        WHERE lp.sku IS NOT NULL AND trim(lp.sku) != ''
          AND lower(trim(lp.sku)) NOT IN (
              SELECT lower(trim(sku)) FROM products WHERE sku IS NOT NULL AND trim(sku) != ''
          )
        """
    )

    conn.execute(
        f"""
        INSERT INTO products (
            category_id, sku, name, unit, description, tech_specs, warranty_terms, delivery_terms,
            cost_with_vat, price_dealers_vat, price_end_vat,
            weight_net_kg, weight_gross_kg, volume_m3, length_cm, width_cm, height_cm,
            related_product_ids_json, analog_product_ids_json, stock_quantity,
            brand, product_status, equipment_type, website_url, photo_urls_json,
            purchase_cost, logistics_cost, extra_cost, target_margin_pct, recommended_price, min_price,
            is_active, created_at
        )
        SELECT
            CASE
                WHEN lp.category_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM product_categories c WHERE c.id = lp.category_id
                ) THEN lp.category_id
                ELSE NULL
            END,
            lp.sku, lp.name, lp.unit, lp.description, lp.tech_specs, lp.warranty_terms, lp.delivery_terms,
            lp.cost_with_vat, lp.price_dealers_vat, lp.price_end_vat,
            lp.weight_net_kg, lp.weight_gross_kg, lp.volume_m3, lp.length_cm, lp.width_cm, lp.height_cm,
            lp.related_product_ids_json, lp.analog_product_ids_json, lp.stock_quantity,
            lp.brand, lp.product_status, lp.equipment_type, lp.website_url, lp.photo_urls_json,
            lp.purchase_cost, lp.logistics_cost, lp.extra_cost, lp.target_margin_pct, lp.recommended_price, lp.min_price,
            lp.is_active, CURRENT_TIMESTAMP
        FROM {alias}.products lp
        WHERE lp.sku IS NULL OR trim(lp.sku) = ''
          AND lp.name NOT IN (SELECT name FROM products)
        """
    )

    conn.commit()
    after = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    return after - before


def main() -> int:
    here = Path(__file__).resolve().parent.parent
    repo = here.parent
    dev_db = repo / "data" / "dev.db"
    legacy_db = here / "crm.db"

    if not legacy_db.is_file():
        print("Нет исходного файла:", legacy_db)
        return 1

    dev_db.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = dev_db.parent / f"dev.db.backup_{ts}"

    if dev_db.is_file():
        shutil.copy2(dev_db, backup_path)
        print("Резервная копия прежнего dev.db ->", backup_path)
    else:
        backup_path = None
        print("Прежнего dev.db не было")

    shutil.copy2(legacy_db, dev_db)
    print("Скопировано", legacy_db, "->", dev_db)

    added_from_backup = 0
    if backup_path and backup_path.is_file():
        conn = sqlite3.connect(str(dev_db))
        conn.execute("PRAGMA foreign_keys = OFF")
        bp = str(backup_path.resolve()).replace("'", "''")
        conn.execute(f"ATTACH DATABASE '{bp}' AS prev")
        try:
            added_from_backup = _merge_products_from_attached(conn, "prev")
        finally:
            conn.execute("DETACH DATABASE prev")
            conn.execute("PRAGMA foreign_keys = ON")
            conn.close()
        print(f"Из предыдущего dev.db добавлено товаров (без дубликатов SKU/имени): {added_from_backup}")

    print("Готово. Перезапустите бэкенд — при старте применятся create_all и sqlite_migrate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
