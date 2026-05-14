@echo off
setlocal
rem Запуск из папки crm-b2b-equipment: двойной клик или вызов из этой папки
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
if not exist "%ROOT%\data" mkdir "%ROOT%\data"
set "DBFILE=%ROOT%\data\dev.db"
set "DBURL=sqlite:///%DBFILE:\=/%"
set CRM_B2B_DATABASE_URL=%DBURL%
set DATABASE_URL=
set SECRET_KEY=dev-secret-key-local
cd /d "%ROOT%\backend"
echo CRM_B2B_DATABASE_URL=%DBURL%
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
