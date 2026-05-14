# dev.ps1 — локальный запуск CRM без Docker (SQLite + Vite dev server)
# Запуск: правой кнопкой → "Run with PowerShell" или в терминале: .\dev.ps1

$root  = $PSScriptRoot
$back  = "$root\backend"
$front = "$root\frontend"

# ---------- зависимости бэкенда ----------
Write-Host "`n[1/4] Устанавливаем Python-зависимости..." -ForegroundColor Cyan
Set-Location $back
python -m pip install --quiet -r requirements.txt

# ---------- зависимости фронтенда ----------
Write-Host "[2/4] Устанавливаем npm-зависимости..." -ForegroundColor Cyan
Set-Location $front
npm install --silent

# ---------- запускаем бэкенд ----------
Write-Host "[3/4] Запускаем FastAPI (http://127.0.0.1:8001)..." -ForegroundColor Cyan
Set-Location $back
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$back'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"
) -WindowStyle Normal

Start-Sleep -Seconds 3   # даём бэку подняться

# ---------- запускаем фронтенд ----------
Write-Host "[4/4] Запускаем Vite (http://localhost:5173)..." -ForegroundColor Cyan
Set-Location $front
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$front'; npm run dev"
) -WindowStyle Normal

Write-Host "`nГотово!" -ForegroundColor Green
Write-Host "  Фронтенд: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  API docs:  http://localhost:8001/docs" -ForegroundColor Yellow
Write-Host "`nЗакройте оба открывшихся окна PowerShell, чтобы остановить серверы.`n"

# Открываем браузер
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"
