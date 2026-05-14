# -*- coding: utf-8 -*-
"""Копирует товары из backend/crm.db в data/dev.db (без дубликатов по артикулу и названию).

Запуск из каталога backend:
  python tools/merge_products_from_crm_db.py
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


def main() -> int:
    here = Path(__file__).resolve().parent.parent
    repo = here.parent
    dev_db = repo / "data" / "dev.db"
    legacy_db = here / "crm.db"

    if not legacy_db.is_file():
        print("Нет файла:", legacy_db)
        return 1
    dev_db.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(dev_db))
    conn.execute("PRAGMA foreign_keys = OFF")

    leg = str(legacy_db.resolve()).replace("'", "''")
    conn.execute(f"ATTACH DATABASE '{leg}' AS legacy")

    before = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]

    # Товары с артикулом: переносим, если такого SKU ещё нет в dev
    conn.execute(
        """
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
        FROM legacy.products lp
        WHERE lp.sku IS NOT NULL AND trim(lp.sku) != ''
          AND lower(trim(lp.sku)) NOT IN (
              SELECT lower(trim(sku)) FROM products WHERE sku IS NOT NULL AND trim(sku) != ''
          )
        """
    )

    # Товары без артикула: по совпадению названия не дублируем
    conn.execute(
        """
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
        FROM legacy.products lp
        WHERE lp.sku IS NULL OR trim(lp.sku) = ''
          AND lp.name NOT IN (SELECT name FROM products)
        """
    )

    conn.commit()
    conn.execute("DETACH DATABASE legacy")
    conn.execute("PRAGMA foreign_keys = ON")

    after = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    conn.close()

    added = after - before
    print(f"Было товаров в dev.db: {before}")
    print(f"Стало: {after} (добавлено из crm.db: {added})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
