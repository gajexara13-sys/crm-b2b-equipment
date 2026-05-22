import io
import json
import os
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.commercial_quote import CommercialQuote, CommercialQuoteItem
from app.models.company import Company
from app.models.product import Product
from app.models.quote_sender_profile import QuoteSenderProfile
from app.models.quote_terms_template import QuoteTermsTemplate
from app.models.request import Request
from app.models.client import Client
from app.quote_document_export import build_quote_docx, build_quote_pdf, safe_filename_part
from app.quote_docxtpl_export import build_quote_docxtpl
from app.routers.auth import get_current_user

router = APIRouter()


def _calc_item_totals(item: "QuoteItemIn", vat_rate: float) -> tuple[float, float, float]:
    qty = item.quantity or 0.0
    base_no_vat = item.price_without_vat or 0.0
    price_with_vat = item.price_with_vat if item.price_with_vat is not None else base_no_vat * (1 + (vat_rate / 100.0))
    line_total = qty * price_with_vat
    pct_discount = (item.discount_pct or 0.0) / 100.0
    fixed_discount = item.discount_amount or 0.0
    discounted = max(line_total * (1 - pct_discount) - fixed_discount, 0.0)
    return price_with_vat, line_total, discounted


def _quote_to_json(q: CommercialQuote, db: Session) -> dict:
    sender = db.query(QuoteSenderProfile).filter(QuoteSenderProfile.id == q.sender_profile_id).first() if q.sender_profile_id else None
    items = (
        db.query(CommercialQuoteItem)
        .filter(CommercialQuoteItem.quote_id == q.id)
        .order_by(CommercialQuoteItem.sort_order.asc(), CommercialQuoteItem.id.asc())
        .all()
    )
    out_items = []
    for it in items:
        out_items.append(
            {
                "id": it.id,
                "product_id": it.product_id,
                "service_item_id": it.service_item_id,
                "item_kind": it.item_kind or ("service" if it.service_item_id else "product"),
                "sort_order": it.sort_order,
                "title": it.title,
                "model": it.model,
                "country": it.country,
                "intro": it.intro,
                "features_text": it.features_text,
                "kit_text": it.kit_text,
                "specs": json.loads(it.specs_json) if it.specs_json else [],
                "photo_urls": json.loads(it.photo_urls_json) if it.photo_urls_json else [],
                "show_intro": it.show_intro,
                "show_features": it.show_features,
                "show_kit": it.show_kit,
                "show_specs": it.show_specs,
                "show_photos": it.show_photos,
                "quantity": it.quantity,
                "price_without_vat": it.price_without_vat,
                "price_with_vat": it.price_with_vat,
                "discount_pct": it.discount_pct,
                "discount_amount": it.discount_amount,
                "line_total_with_vat": it.line_total_with_vat,
                "line_total_discounted": it.line_total_discounted,
                "calibration_included": it.calibration_included,
            }
        )
    # Resolve request info
    req = db.query(Request).filter(Request.id == q.request_id).first() if q.request_id else None
    req_client = db.query(Client).filter(Client.id == req.client_id).first() if req else None

    return {
        "id": q.id,
        "number": q.number,
        "status": q.status,
        "quote_kind": q.quote_kind or "product",
        "quote_date": q.quote_date,
        "deal_id": q.deal_id,
        "request_id": q.request_id,
        "request_number": req.number if req else None,
        "request_client_name": req_client.name if req_client else None,
        "sender_profile_id": q.sender_profile_id,
        "sender_name": sender.legal_name if sender else None,
        "recipient_company_id": q.recipient_company_id,
        "recipient_name": q.recipient_name,
        "recipient_address": q.recipient_address,
        "recipient_contact_name": q.recipient_contact_name,
        "recipient_contact_position": q.recipient_contact_position,
        "recipient_contact_phone": q.recipient_contact_phone,
        "recipient_contact_email": q.recipient_contact_email,
        "greeting_name": q.greeting_name,
        "intro_text": q.intro_text,
        "show_discount_column": q.show_discount_column,
        "currency": q.currency,
        "vat_rate": q.vat_rate,
        "fx_rate": q.fx_rate,
        "subtotal": q.subtotal,
        "discount_total": q.discount_total,
        "total_with_vat": q.total_with_vat,
        "terms_template_id": q.terms_template_id,
        "terms_production_country": q.terms_production_country,
        "terms_warranty": q.terms_warranty,
        "terms_delivery": q.terms_delivery,
        "terms_payment": q.terms_payment,
        "terms_currency_note": q.terms_currency_note,
        "terms_address_note": q.terms_address_note,
        "terms_price_validity": q.terms_price_validity,
        "terms_lead_time": q.terms_lead_time,
        "pdf_file_path": q.pdf_file_path,
        "created_at": q.created_at,
        "updated_at": q.updated_at,
        "items": out_items,
    }


def _sender_export_dict(s: QuoteSenderProfile | None) -> dict:
    if not s:
        return {}
    return {
        "name": s.name,
        "legal_form": s.legal_form or "",
        "legal_name": s.legal_name or "",
        "legal_address": s.legal_address or "",
        "tax_number": s.tax_number or "",
        "kpp": s.kpp or "",
        "ogrn": s.ogrn or "",
        "phone": s.phone or "",
        "email": s.email or "",
        "website": s.website or "",
        "logo_url":       (s.logo_url       or "").strip(),
        "signature_url":  (s.signature_url  or "").strip(),
        "stamp_url":      (s.stamp_url      or "").strip(),
        "signer_name":    s.signer_name     or "",
        "signer_position": s.signer_position or "",
    }


def _normalize_quote_date(val) -> str:
    if val is None:
        return ""
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


def _item_export_view(it: dict) -> dict:
    row = dict(it)
    if not row.get("show_intro"):
        row["intro"] = None
    if not row.get("show_features"):
        row["features_text"] = None
    if not row.get("show_kit"):
        row["kit_text"] = None
    if not row.get("show_specs"):
        row["specs"] = []
    if not row.get("show_photos"):
        row["photo_urls"] = []
    return row


def _export_ctx(q: CommercialQuote, db: Session) -> dict:
    payload = _quote_to_json(q, db)
    payload["quote_date"] = _normalize_quote_date(payload.get("quote_date"))
    raw_items = payload.pop("items", None) or []
    sender = db.query(QuoteSenderProfile).filter(QuoteSenderProfile.id == q.sender_profile_id).first() if q.sender_profile_id else None

    # В шапку КП подставляем компанию из справочника, если текст получателя пуст
    if q.recipient_company_id:
        comp = db.query(Company).filter(Company.id == q.recipient_company_id).first()
        if comp:
            if not (payload.get("recipient_name") or "").strip():
                payload["recipient_name"] = comp.name
            if not (payload.get("recipient_address") or "").strip() and (
                comp.address or comp.city or comp.region
            ):
                parts = [p for p in (comp.region, comp.city, comp.address) if p and str(p).strip()]
                if parts:
                    payload["recipient_address"] = ", ".join(str(p).strip() for p in parts)

    return {
        "quote": payload,
        "sender": _sender_export_dict(sender),
        "items": [_item_export_view(it) for it in raw_items],
    }


class QuoteItemIn(BaseModel):
    product_id: Optional[int] = None
    service_item_id: Optional[int] = None
    item_kind: str = "product"
    sort_order: int = 0
    title: str
    model: Optional[str] = None
    country: Optional[str] = None
    intro: Optional[str] = None
    features_text: Optional[str] = None
    kit_text: Optional[str] = None
    specs: list[dict] = Field(default_factory=list)
    photo_urls: list[str] = Field(default_factory=list)
    show_intro: bool = True
    show_features: bool = True
    show_kit: bool = True
    show_specs: bool = True
    show_photos: bool = True
    quantity: float = 1.0
    price_without_vat: float = 0.0
    price_with_vat: Optional[float] = None
    discount_pct: float = 0.0
    discount_amount: float = 0.0
    calibration_included: bool = False


class QuoteIn(BaseModel):
    number: Optional[str] = None
    status: str = "draft"
    quote_kind: str = "product"
    quote_date: Optional[date] = None
    deal_id: Optional[int] = None
    request_id: Optional[int] = None
    sender_profile_id: Optional[int] = None
    recipient_company_id: Optional[int] = None
    recipient_name: Optional[str] = None
    recipient_address: Optional[str] = None
    recipient_contact_name: Optional[str] = None
    recipient_contact_position: Optional[str] = None
    recipient_contact_phone: Optional[str] = None
    recipient_contact_email: Optional[str] = None
    greeting_name: Optional[str] = None
    intro_text: Optional[str] = None
    show_discount_column: bool = True
    currency: str = "RUB"
    vat_rate: float = 20.0
    fx_rate: float = 1.0
    terms_template_id: Optional[int] = None
    terms_production_country: Optional[str] = None
    terms_warranty: Optional[str] = None
    terms_delivery: Optional[str] = None
    terms_payment: Optional[str] = None
    terms_currency_note: Optional[str] = None
    terms_address_note: Optional[str] = None
    terms_price_validity: Optional[str] = None
    terms_lead_time: Optional[str] = None
    items: list[QuoteItemIn] = Field(default_factory=list)


@router.get("/companies/search")
def search_companies(
    q: str = "",
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Поиск по клиентам (таблица clients) + CRM-компаниям (таблица companies)."""
    from app.models.client import Client
    from app.models.contact import Contact
    from app.name_declension import inflect_position, parse_full_name

    results: list[dict] = []

    # ── 1. Клиенты (основная база) ────────────────────────────────────────────
    clients = (
        db.query(Client)
        .filter(Client.name.ilike(f"%{q}%"))
        .order_by(Client.name.asc())
        .limit(15)
        .all()
    )
    for cl in clients:
        parsed = parse_full_name(cl.contact_name or "") if cl.contact_name else {}
        pos = getattr(cl, "contact_position", None) or ""
        results.append({
            "id": f"client-{cl.id}",
            "name": cl.name,
            "address": (cl.address or "").strip(),
            "contact_full_name": cl.contact_name,
            "contact_position": pos or None,
            "contact_position_dative": inflect_position(pos) if pos else None,
            "contact_dative_short": parsed.get("dative_short", ""),
            "contact_greeting": parsed.get("greeting", ""),
        })

    # ── 2. CRM-компании (если заполнены) ─────────────────────────────────────
    if len(results) < 15:
        crm_companies = (
            db.query(Company)
            .filter(Company.name.ilike(f"%{q}%"))
            .order_by(Company.name.asc())
            .limit(15 - len(results))
            .all()
        )
        for comp in crm_companies:
            contact = (
                db.query(Contact)
                .filter(Contact.company_id == comp.id, Contact.is_primary == True)
                .first()
            ) or db.query(Contact).filter(Contact.company_id == comp.id).first()

            address_parts = [p for p in (comp.region, comp.city, comp.address) if p and str(p).strip()]
            address = ", ".join(str(p).strip() for p in address_parts)

            entry: dict = {
                "id": f"company-{comp.id}",
                "name": comp.name,
                "address": address,
                "contact_full_name": None,
                "contact_position": None,
                "contact_position_dative": None,
                "contact_dative_short": "",
                "contact_greeting": "",
            }
            if contact:
                parsed = parse_full_name(contact.full_name or "")
                entry["contact_full_name"] = contact.full_name
                entry["contact_position"] = contact.position
                entry["contact_position_dative"] = inflect_position(contact.position or "")
                entry["contact_dative_short"] = parsed.get("dative_short", "")
                entry["contact_greeting"] = parsed.get("greeting", "")
            results.append(entry)

    return results


@router.get("/sender-profiles")
def list_sender_profiles(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(QuoteSenderProfile).order_by(QuoteSenderProfile.name.asc()).all()


@router.post("/sender-profiles")
def create_sender_profile(data: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = QuoteSenderProfile(**data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/sender-profiles/{pid}")
def get_sender_profile(pid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(QuoteSenderProfile).filter(QuoteSenderProfile.id == pid).first()
    if not p:
        raise HTTPException(404, "Профиль не найден")
    return p


@router.put("/sender-profiles/{pid}")
def update_sender_profile(pid: int, data: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(QuoteSenderProfile).filter(QuoteSenderProfile.id == pid).first()
    if not p:
        raise HTTPException(404, "Профиль не найден")
    for k, v in data.items():
        if hasattr(p, k):
            setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/sender-profiles/{pid}")
def delete_sender_profile(pid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(QuoteSenderProfile).filter(QuoteSenderProfile.id == pid).first()
    if not p:
        raise HTTPException(404, "Профиль не найден")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.get("/terms-templates")
def list_terms_templates(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(QuoteTermsTemplate).order_by(QuoteTermsTemplate.name.asc()).all()


@router.post("/terms-templates")
def create_terms_template(data: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = QuoteTermsTemplate(**data)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/terms-templates/{tid}")
def update_terms_template(tid: int, data: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(QuoteTermsTemplate).filter(QuoteTermsTemplate.id == tid).first()
    if not t:
        raise HTTPException(404, "Шаблон не найден")
    for k, v in data.items():
        if hasattr(t, k):
            setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/terms-templates/{tid}")
def delete_terms_template(tid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(QuoteTermsTemplate).filter(QuoteTermsTemplate.id == tid).first()
    if not t:
        raise HTTPException(404, "Шаблон не найден")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.get("/requests/search")
def search_requests(
    q: str = "",
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Поиск заявок по номеру или названию клиента для привязки к КП."""
    query = db.query(Request, Client).outerjoin(Client, Request.client_id == Client.id)
    if q:
        query = query.filter(
            Request.number.ilike(f"%{q}%") | Client.name.ilike(f"%{q}%")
        )
    rows = query.order_by(Request.created_at.desc()).limit(20).all()
    result = []
    for req, client in rows:
        result.append({
            "id": req.id,
            "number": req.number,
            "stage": req.stage,
            "status": req.status,
            "client_id": req.client_id,
            "client_name": client.name if client else None,
            "client_address": client.address if client else None,
            "client_contact_name": client.contact_name if client else None,
            "client_contact_position": getattr(client, "contact_position", None) if client else None,
        })
    return result


@router.get("")
def list_quotes(
    recipient_company_id: Optional[int] = None,
    status: Optional[str] = None,
    request_id: Optional[int] = None,
    quote_kind: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(CommercialQuote)
    if recipient_company_id is not None:
        q = q.filter(CommercialQuote.recipient_company_id == recipient_company_id)
    if status:
        q = q.filter(CommercialQuote.status == status)
    if request_id is not None:
        q = q.filter(CommercialQuote.request_id == request_id)
    if quote_kind:
        q = q.filter(CommercialQuote.quote_kind == quote_kind)
    rows = q.order_by(CommercialQuote.created_at.desc()).all()
    return [_quote_to_json(r, db) for r in rows]


@router.get("/{id}/export.docx")
def export_quote_docx(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(CommercialQuote).filter(CommercialQuote.id == id).first()
    if not q:
        raise HTTPException(404, "КП не найдено")
    ctx = _export_ctx(q, db)
    if os.environ.get("QUOTE_USE_PROGRAMMATIC_DOCX", "").strip() in ("1", "true", "yes"):
        body = build_quote_docx(ctx)
    else:
        try:
            body = build_quote_docxtpl(ctx)
        except Exception as _exc:
            import logging, traceback
            logging.getLogger(__name__).error("build_quote_docxtpl failed: %s\n%s", _exc, traceback.format_exc())
            body = build_quote_docx(ctx)
    base = safe_filename_part(q.number or f"KP-{q.id}", f"KP-{q.id}")
    fn = f"{base}.docx"
    return StreamingResponse(
        io.BytesIO(body),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{fn}"'},
    )


@router.get("/{id}/export.pdf")
def export_quote_pdf(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    import tempfile, os
    q = db.query(CommercialQuote).filter(CommercialQuote.id == id).first()
    if not q:
        raise HTTPException(404, "КП не найдено")
    ctx = _export_ctx(q, db)
    base = safe_filename_part(q.number or f"KP-{q.id}", f"KP-{q.id}")

    # Генерируем DOCX из шаблона, затем конвертируем в PDF через MS Word
    try:
        docx_bytes = build_quote_docxtpl(ctx)
    except Exception as exc:
        import logging, traceback
        logging.getLogger(__name__).error("build_quote_docxtpl failed for PDF: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(500, f"Ошибка генерации DOCX для конвертации в PDF: {exc}") from exc

    try:
        from docx2pdf import convert
        with tempfile.TemporaryDirectory() as tmp:
            docx_path = os.path.join(tmp, f"{base}.docx")
            pdf_path  = os.path.join(tmp, f"{base}.pdf")
            with open(docx_path, "wb") as f:
                f.write(docx_bytes)
            convert(docx_path, pdf_path)
            with open(pdf_path, "rb") as f:
                body = f.read()
    except Exception as exc:
        raise HTTPException(503, f"Ошибка конвертации в PDF: {exc}") from exc

    fn = f"{base}.pdf"
    return StreamingResponse(
        io.BytesIO(body),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fn}"'},
    )


@router.get("/{id}")
def get_quote(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(CommercialQuote).filter(CommercialQuote.id == id).first()
    if not q:
        raise HTTPException(404, "КП не найдено")
    return _quote_to_json(q, db)


@router.post("")
def create_quote(data: QuoteIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if data.recipient_company_id is not None:
        c = db.query(Company).filter(Company.id == data.recipient_company_id).first()
        if not c:
            raise HTTPException(404, "Получатель не найден")
    if data.sender_profile_id is not None:
        s = db.query(QuoteSenderProfile).filter(QuoteSenderProfile.id == data.sender_profile_id).first()
        if not s:
            raise HTTPException(404, "Отправитель не найден")
    if data.terms_template_id is not None:
        t = db.query(QuoteTermsTemplate).filter(QuoteTermsTemplate.id == data.terms_template_id).first()
        if not t:
            raise HTTPException(404, "Шаблон условий не найден")

    q = CommercialQuote(
        number=data.number,
        status=data.status,
        quote_kind=data.quote_kind or "product",
        quote_date=data.quote_date or date.today(),
        deal_id=data.deal_id,
        request_id=data.request_id,
        sender_profile_id=data.sender_profile_id,
        recipient_company_id=data.recipient_company_id,
        recipient_name=data.recipient_name,
        recipient_address=data.recipient_address,
        recipient_contact_name=data.recipient_contact_name,
        recipient_contact_position=data.recipient_contact_position,
        recipient_contact_phone=data.recipient_contact_phone,
        recipient_contact_email=data.recipient_contact_email,
        greeting_name=data.greeting_name,
        intro_text=data.intro_text,
        show_discount_column=data.show_discount_column,
        currency=data.currency,
        vat_rate=data.vat_rate,
        fx_rate=data.fx_rate,
        terms_template_id=data.terms_template_id,
        terms_production_country=data.terms_production_country,
        terms_warranty=data.terms_warranty,
        terms_delivery=data.terms_delivery,
        terms_payment=data.terms_payment,
        terms_currency_note=data.terms_currency_note,
        terms_address_note=data.terms_address_note,
        terms_price_validity=data.terms_price_validity,
        terms_lead_time=data.terms_lead_time,
    )
    db.add(q)
    db.flush()

    subtotal = 0.0
    discount_total = 0.0
    for idx, i in enumerate(data.items):
        if i.product_id is not None:
            exists = db.query(Product).filter(Product.id == i.product_id).first()
            if not exists:
                raise HTTPException(404, f"Товар #{i.product_id} не найден")
        price_with_vat, line_total, discounted = _calc_item_totals(i, data.vat_rate)
        subtotal += line_total
        discount_total += (line_total - discounted)
        db.add(
            CommercialQuoteItem(
                quote_id=q.id,
                product_id=i.product_id,
                service_item_id=i.service_item_id,
                item_kind=i.item_kind or ("service" if i.service_item_id else "product"),
                sort_order=i.sort_order if i.sort_order else idx,
                title=i.title,
                model=i.model,
                country=i.country,
                intro=i.intro,
                features_text=i.features_text,
                kit_text=i.kit_text,
                specs_json=json.dumps(i.specs, ensure_ascii=False),
                photo_urls_json=json.dumps(i.photo_urls, ensure_ascii=False),
                show_intro=i.show_intro,
                show_features=i.show_features,
                show_kit=i.show_kit,
                show_specs=i.show_specs,
                show_photos=i.show_photos,
                quantity=i.quantity,
                price_without_vat=i.price_without_vat,
                price_with_vat=price_with_vat,
                discount_pct=i.discount_pct,
                discount_amount=i.discount_amount,
                line_total_with_vat=line_total,
                line_total_discounted=discounted,
                calibration_included=i.calibration_included,
            )
        )

    q.subtotal = subtotal
    q.discount_total = discount_total
    q.total_with_vat = max(subtotal - discount_total, 0.0)
    db.commit()
    db.refresh(q)
    return _quote_to_json(q, db)


@router.put("/{id}")
def update_quote(id: int, data: QuoteIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(CommercialQuote).filter(CommercialQuote.id == id).first()
    if not q:
        raise HTTPException(404, "КП не найдено")

    for k, v in data.model_dump(exclude={"items"}).items():
        setattr(q, k, v)

    db.query(CommercialQuoteItem).filter(CommercialQuoteItem.quote_id == q.id).delete()
    subtotal = 0.0
    discount_total = 0.0
    for idx, i in enumerate(data.items):
        price_with_vat, line_total, discounted = _calc_item_totals(i, data.vat_rate)
        subtotal += line_total
        discount_total += (line_total - discounted)
        db.add(
            CommercialQuoteItem(
                quote_id=q.id,
                product_id=i.product_id,
                service_item_id=i.service_item_id,
                item_kind=i.item_kind or ("service" if i.service_item_id else "product"),
                sort_order=i.sort_order if i.sort_order else idx,
                title=i.title,
                model=i.model,
                country=i.country,
                intro=i.intro,
                features_text=i.features_text,
                kit_text=i.kit_text,
                specs_json=json.dumps(i.specs, ensure_ascii=False),
                photo_urls_json=json.dumps(i.photo_urls, ensure_ascii=False),
                show_intro=i.show_intro,
                show_features=i.show_features,
                show_kit=i.show_kit,
                show_specs=i.show_specs,
                show_photos=i.show_photos,
                quantity=i.quantity,
                price_without_vat=i.price_without_vat,
                price_with_vat=price_with_vat,
                discount_pct=i.discount_pct,
                discount_amount=i.discount_amount,
                line_total_with_vat=line_total,
                line_total_discounted=discounted,
                calibration_included=i.calibration_included,
            )
        )

    q.subtotal = subtotal
    q.discount_total = discount_total
    q.total_with_vat = max(subtotal - discount_total, 0.0)
    db.commit()
    db.refresh(q)
    return _quote_to_json(q, db)


@router.post("/{id}/duplicate")
def duplicate_quote(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    src = db.query(CommercialQuote).filter(CommercialQuote.id == id).first()
    if not src:
        raise HTTPException(404, "КП не найдено")
    src_items = db.query(CommercialQuoteItem).filter(CommercialQuoteItem.quote_id == id).all()

    clone = CommercialQuote(
        number=None,
        status="draft",
        quote_kind=src.quote_kind or "product",
        quote_date=date.today(),
        deal_id=src.deal_id,
        request_id=src.request_id,
        sender_profile_id=src.sender_profile_id,
        recipient_company_id=src.recipient_company_id,
        recipient_name=src.recipient_name,
        recipient_address=src.recipient_address,
        recipient_contact_name=src.recipient_contact_name,
        recipient_contact_position=src.recipient_contact_position,
        recipient_contact_phone=src.recipient_contact_phone,
        recipient_contact_email=src.recipient_contact_email,
        greeting_name=src.greeting_name,
        intro_text=src.intro_text,
        show_discount_column=src.show_discount_column,
        currency=src.currency,
        vat_rate=src.vat_rate,
        fx_rate=src.fx_rate,
        terms_template_id=src.terms_template_id,
        terms_production_country=src.terms_production_country,
        terms_warranty=src.terms_warranty,
        terms_delivery=src.terms_delivery,
        terms_payment=src.terms_payment,
        terms_currency_note=src.terms_currency_note,
        terms_address_note=src.terms_address_note,
        terms_price_validity=src.terms_price_validity,
        terms_lead_time=src.terms_lead_time,
    )
    db.add(clone)
    db.flush()
    for i in src_items:
        db.add(
            CommercialQuoteItem(
                quote_id=clone.id,
                product_id=i.product_id,
                service_item_id=i.service_item_id,
                item_kind=i.item_kind or "product",
                sort_order=i.sort_order,
                title=i.title,
                model=i.model,
                country=i.country,
                intro=i.intro,
                features_text=i.features_text,
                kit_text=i.kit_text,
                specs_json=i.specs_json,
                photo_urls_json=i.photo_urls_json,
                show_intro=i.show_intro,
                show_features=i.show_features,
                show_kit=i.show_kit,
                show_specs=i.show_specs,
                show_photos=i.show_photos,
                quantity=i.quantity,
                price_without_vat=i.price_without_vat,
                price_with_vat=i.price_with_vat,
                discount_pct=i.discount_pct,
                discount_amount=i.discount_amount,
                line_total_with_vat=i.line_total_with_vat,
                line_total_discounted=i.line_total_discounted,
                calibration_included=i.calibration_included,
            )
        )
    clone.subtotal = src.subtotal
    clone.discount_total = src.discount_total
    clone.total_with_vat = src.total_with_vat
    db.commit()
    db.refresh(clone)
    return _quote_to_json(clone, db)


@router.delete("/{id}")
def delete_quote(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(CommercialQuote).filter(CommercialQuote.id == id).first()
    if not q:
        raise HTTPException(404, "КП не найдено")
    db.query(CommercialQuoteItem).filter(CommercialQuoteItem.quote_id == id).delete()
    db.delete(q)
    db.commit()
    return {"ok": True}
