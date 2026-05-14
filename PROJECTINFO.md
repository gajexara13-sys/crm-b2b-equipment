# CRM RUTEST — контекст проекта

## Назначение

B2B CRM-система для продаж лабораторного оборудования (RuTest). Охватывает:
- Воронку продаж и управление сделками
- Каталог товаров (испытательное оборудование)
- Коммерческие предложения (генерация docx через шаблоны)
- Контрагентов, контакты, объекты
- Каталог услуг и справочник разработчика
- Систему задач для менеджеров

---

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Python 3.13, FastAPI 0.110, SQLAlchemy 2.0, passlib+bcrypt, python-jose (JWT) |
| Frontend | React 18 (Vite), axios, react-router-dom |
| БД | SQLite (`data/dev.db`) в разработке; PostgreSQL в продакшене |
| Документы | docxtpl (генерация КП из .docx-шаблонов) |
| Сервер | uvicorn (локально), nginx + docker-compose (прод) |

---

## Структура проекта

```
crm-b2b-equipment/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── config.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── client.py / company.py / contact.py
│   │   │   ├── request.py / deal.py / deal_item.py / deal_task.py
│   │   │   ├── product.py / product_category.py
│   │   │   ├── quote.py / commercial_quote.py
│   │   │   ├── quote_sender_profile.py / quote_terms_template.py
│   │   │   ├── catalog_item.py / material_norm.py / material_category.py
│   │   │   ├── price_list_entry.py / price_position.py
│   │   │   └── test_indicator.py / material_test_object.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── clients.py / crm_companies.py / crm_deals.py
│   │   │   ├── requests.py / request_notes.py
│   │   │   ├── tasks.py
│   │   │   ├── crm_quotes.py / crm_catalog.py
│   │   │   ├── catalog.py / material_norms.py
│   │   │   ├── reference.py / uploads.py
│   │   │   ├── samples.py / tests.py / protocols.py
│   │   │   └── (остальные роутеры)
│   │   └── services/
│   ├── templates/          # .docx шаблоны КП (kp_rutesttpl.docx и др.)
│   ├── tools/              # dev-утилиты (диагностика БД, патчи шаблонов)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx              # Роутинг, логин, Layout, PageRequests, PageClients
│   │   ├── Funnel.jsx           # Воронка (kanban)
│   │   ├── Today.jsx            # Страница «Задачи»
│   │   ├── ProductCatalog.jsx   # Каталог товаров
│   │   ├── CommercialOffers.jsx # Коммерческие предложения
│   │   ├── SenderProfiles.jsx   # Профили отправителей КП
│   │   ├── Modal.jsx            # Универсальная модалка
│   │   ├── ConfirmDialog.jsx    # Диалог подтверждения
│   │   └── TestABS.jsx          # Форма испытания (ГОСТ Р 58401)
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── nginx/nginx.conf
├── docker-compose.yml
├── dev.ps1                  # Запуск локального окружения (PowerShell)
└── .env.example
```

---

## Навигация (боковое меню)

**CRM:**
- `/requests` — Заявки
- `/funnel` — Воронка
- `/tasks` — Задачи
- `/quotes` — Коммерческие предложения
- `/sender-profiles` — Профили отправителей

**БАЗА:**
- `/catalog-products` — Каталог товаров
- `/counterparties` — Контрагенты
- `/contacts` — Контакты
- `/objects` — Объекты
- `/catalog-services` — Каталог услуг
- `/dev-reference` — Справочник разработчика
- `/equipment` — Оборудование

---

## Локальный запуск

Используй `dev.ps1` или запускай вручную:

**Бэкенд** (из папки `backend/`):
```powershell
$env:DATABASE_URL='sqlite:///./crm.db'
$env:SECRET_KEY='dev_secret'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Фронтенд** (из папки `frontend/`):
```powershell
npm run dev
```

Открывать: `http://localhost:5173`

**Учётные данные по умолчанию:**
- Email: `admin@crm.local`
- Пароль: `admin123`

---

## Важные технические решения

1. **Генерация КП** — через `docxtpl`. Шаблоны `.docx` хранятся в `backend/templates/`. Экспорт: `quote_docxtpl_export.py`.
2. **`redirect_slashes=False`** в FastAPI — все роуты без trailing slash.
3. **JWT** — токен в `localStorage('token')`, добавляется через `axios.interceptors.request`.
4. **SQLite в разработке** — файл `data/dev.db` (вне git). В продакшене PostgreSQL через Docker.
5. **Тёмная/светлая тема** — переключатель в Layout, сохраняется в `localStorage('theme')`.
