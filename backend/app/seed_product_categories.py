from app.database import SessionLocal
from app.models.product_category import ProductCategory


CATEGORIES = [
    ("asphalt", "асфальтобетонные смеси"),
    ("inert", "инертные материалы"),
    ("bitumen", "битумные материалы"),
    ("mineral_binder", "минеральные вяжущие"),
    ("concrete", "бетонные смеси"),
    ("stabilized_soils", "укрепленные грунты"),
    ("soils", "грунты"),
    ("field_measurements", "полевые измерения"),
    ("general_lab", "общелаб"),
]


def run() -> None:
    db = SessionLocal()
    try:
        for code, name in CATEGORIES:
            existing = db.query(ProductCategory).filter(ProductCategory.code == code).first()
            if not existing:
                db.add(ProductCategory(code=code, name=name))
        db.commit()
        print("Product categories seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
