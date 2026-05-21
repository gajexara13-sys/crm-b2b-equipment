from pathlib import Path as _Path
from dotenv import load_dotenv as _load_dotenv
_load_dotenv(_Path(__file__).resolve().parent.parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.models.deal_task import DealTask  # noqa: F401 — таблица deal_tasks
from app.models.request_note import RequestNote  # noqa: F401 — таблица request_notes
from app.routers import (
    auth,
    clients,
    requests,
    samples,
    tests,
    protocols,
    tasks,
    request_notes,
    catalog,
    material_norms,
    reference,
    crm_companies,
    crm_catalog,
    crm_deals,
    crm_quotes,
    uploads,
    services_catalog,
)
from app.sqlite_migrate import run_sqlite_migrations
from app.models.material_norm import MaterialNorm  # noqa: F401
from app.models.material_category import MaterialCategory  # noqa: F401
from app.models.material_test_object import MaterialTestObject  # noqa: F401
from app.models.test_indicator import TestIndicator  # noqa: F401
from app.models.price_list_entry import PriceListEntry  # noqa: F401
from app.models.price_position import PricePosition  # noqa: F401
from app.models.price_position_indicator import PricePositionIndicator  # noqa: F401
from app.models.price_position import PricePosition  # noqa: F401
from app.models.price_position_indicator import PricePositionIndicator  # noqa: F401
from app.models.company import Company  # noqa: F401
from app.models.contact import Contact  # noqa: F401
from app.models.product_category import ProductCategory  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.deal import Deal  # noqa: F401
from app.models.deal_item import DealItem  # noqa: F401
from app.models.quote import Quote  # noqa: F401
from app.models.quote_sender_profile import QuoteSenderProfile  # noqa: F401
from app.models.quote_terms_template import QuoteTermsTemplate  # noqa: F401
from app.models.commercial_quote import CommercialQuote, CommercialQuoteItem  # noqa: F401
from app.models.service_category import ServiceCategory, ServiceSubcategory, ServiceItem  # noqa: F401

Base.metadata.create_all(bind=engine)
run_sqlite_migrations()

app = FastAPI(title="CRM RUTEST", version="1.0.0", redirect_slashes=False)


@app.on_event("startup")
def _log_database_connection() -> None:
    """В консоли uvicorn видно, какой файл SQLite реально открыт (важно при нескольких .db)."""
    print(f"[CRM RUTEST] Database: {engine.url}", flush=True)

# CORS: список разрешённых origin задаётся через CRM_ALLOWED_ORIGINS,
# по умолчанию (в dev) — разрешаем все. В продакшне в .env прописать домен.
import os as _os
_allowed = _os.getenv("CRM_ALLOWED_ORIGINS", "").strip()
_origins = [o.strip() for o in _allowed.split(",") if o.strip()] if _allowed else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(clients.router,   prefix="/api/clients",   tags=["clients"])
app.include_router(requests.router,  prefix="/api/requests",  tags=["requests"])
app.include_router(samples.router,   prefix="/api/samples",   tags=["samples"])
app.include_router(tests.router,     prefix="/api/tests",     tags=["tests"])
app.include_router(protocols.router, prefix="/api/protocols", tags=["protocols"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(request_notes.router, prefix="/api/requests", tags=["request-notes"])
app.include_router(catalog.router, prefix="/api/catalog", tags=["catalog"])
app.include_router(material_norms.router, prefix="/api/material-norms", tags=["material-norms"])
app.include_router(reference.router, prefix="/api/reference", tags=["reference"])
app.include_router(crm_companies.router, prefix="/api/crm", tags=["crm-companies"])
app.include_router(crm_catalog.router, prefix="/api/crm/catalog", tags=["crm-catalog"])
app.include_router(crm_deals.router, prefix="/api/crm/deals", tags=["crm-deals"])
app.include_router(crm_quotes.router, prefix="/api/crm/quotes", tags=["crm-quotes"])
app.include_router(uploads.router,          prefix="/api/uploads",          tags=["uploads"])
app.include_router(services_catalog.router, prefix="/api/services-catalog",  tags=["services-catalog"])

_UPLOADS_DIR = _Path(__file__).resolve().parent.parent / "uploads"
_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_UPLOADS_DIR)), name="uploads")

@app.get("/api/health")
def health(): return {"status": "ok", "service": "CRM RUTEST"}
