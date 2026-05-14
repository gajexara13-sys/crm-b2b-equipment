"""Сборка справочника категория → объект → показатели + прайс из material_norms и catalog_items."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.catalog_item import CatalogItem
from app.models.material_category import MaterialCategory
from app.models.material_norm import MaterialNorm
from app.models.material_test_object import MaterialTestObject
from app.models.price_list_entry import PriceListEntry
from app.models.test_indicator import TestIndicator


def sync_reference_from_legacy(db: Session) -> dict:
    db.query(PriceListEntry).delete()
    db.query(TestIndicator).delete()
    db.query(MaterialTestObject).delete()
    db.query(MaterialCategory).delete()
    db.flush()

    cat_ids: dict[str, int] = {}
    order_c = 0
    for mn in db.query(MaterialNorm).order_by(MaterialNorm.sort_order, MaterialNorm.id):
        name = (mn.category_label or "").strip() or "Без категории"
        if name not in cat_ids:
            c = MaterialCategory(name=name, sort_order=order_c)
            order_c += 1
            db.add(c)
            db.flush()
            cat_ids[name] = c.id
    db.flush()

    obj_key_to_id: dict[tuple[int, str], int] = {}
    order_o = 0
    for mn in db.query(MaterialNorm).order_by(MaterialNorm.sort_order, MaterialNorm.id):
        cname = (mn.category_label or "").strip() or "Без категории"
        cid = cat_ids[cname]
        mname = (mn.material_label or "").strip()
        if not mname:
            continue
        k = (cid, mname)
        if k in obj_key_to_id:
            continue
        to = MaterialTestObject(
            category_id=cid,
            name=mname,
            variants_json=None,
            sort_order=order_o,
        )
        order_o += 1
        db.add(to)
        db.flush()
        obj_key_to_id[k] = to.id
    db.flush()

    ind_count = 0
    seen: set[tuple[int, str, str]] = set()
    for ci in db.query(CatalogItem).order_by(CatalogItem.sort_order, CatalogItem.id):
        blob = (ci.material_object or "").lower().replace("\r", "\n")
        for (cid, mname), oid in obj_key_to_id.items():
            nlow = mname.lower()
            if nlow not in blob:
                continue
            ch = (ci.characteristic or "").strip()
            st = (ci.standard_ref or "").strip()
            dedupe = (oid, ch, st)
            if dedupe in seen:
                continue
            seen.add(dedupe)
            ti = TestIndicator(
                test_object_id=oid,
                characteristic=ch,
                range_text=ci.range_text,
                standard_ref=ci.standard_ref,
                sort_order=ind_count,
            )
            db.add(ti)
            db.flush()
            ind_count += 1
            pcode = (ch[:200] if ch else f"П-{ti.id}").replace("\n", " ")
            pr = float(ci.price_rub) if ci.price_rub is not None else None
            db.add(
                PriceListEntry(
                    test_indicator_id=ti.id,
                    price_code=pcode,
                    price_rub=pr,
                )
            )

    db.commit()
    return {
        "categories": len(cat_ids),
        "objects": len(obj_key_to_id),
        "indicators": ind_count,
    }
