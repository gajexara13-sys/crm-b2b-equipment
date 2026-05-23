# ─────────────────────────────────────────────────────────────────────────────
# CRM RUTEST — забор бэкапа БД с сервера на локальный ПК.
#
# Что делает:
#   1. Подключается к серверу по SSH (по ключу — без пароля)
#   2. Запускает /usr/local/bin/crm-backup-db (свежий бэкап на сервере)
#   3. Через scp скачивает самый свежий .db и uploads.tar.gz
#   4. Хранит локально N последних копий, удаляет старые
#   5. Пишет лог
#
# Запуск вручную: powershell -ExecutionPolicy Bypass -File deploy\backup-pull.ps1
# Автозапуск:    см. README в этой папке (Task Scheduler)
# ─────────────────────────────────────────────────────────────────────────────

# ── Настройки ────────────────────────────────────────────────────────────────
$ServerHost  = "root@31.177.82.167"   # SSH-адрес сервера
$ServerSrc   = "/opt/crm/data/backups" # папка бэкапов на сервере
$LocalDest   = "C:\CRM-Backups"        # куда складывать на ПК
$KeepCount   = 30                      # сколько последних бэкапов хранить
$LogFile     = "$LocalDest\backup.log"

# ── Создание папки, если нет ─────────────────────────────────────────────────
if (-not (Test-Path $LocalDest)) {
    New-Item -ItemType Directory -Path $LocalDest -Force | Out-Null
}

# Кодировка UTF-8 для консоли и stdout — чтобы кириллица в логах не плыла
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    # Пишем напрямую через .NET — без BOM, корректный UTF-8
    [System.IO.File]::AppendAllText($LogFile, ($line + "`r`n"), [System.Text.UTF8Encoding]::new($false))
    Write-Host $line
}

Write-Log "─── Старт ───"

# ── 1. Создаём свежий бэкап на сервере ───────────────────────────────────────
Write-Log "Запуск бэкапа на сервере..."
$result = ssh -o BatchMode=yes -o ConnectTimeout=10 $ServerHost "sudo /usr/local/bin/crm-backup-db 2>&1" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log "ОШИБКА: бэкап на сервере не выполнился. $result"
    exit 1
}
Write-Log "Бэкап на сервере: $result"

# ── 2. Находим имя свежего файла ─────────────────────────────────────────────
$latestDb = ssh -o BatchMode=yes $ServerHost "ls -t $ServerSrc/prod-*.db 2>/dev/null | head -1" 2>&1
if ($LASTEXITCODE -ne 0 -or -not $latestDb) {
    Write-Log "ОШИБКА: не нашли свежий .db на сервере"
    exit 1
}
$latestDb = $latestDb.Trim()
$latestUp = ssh -o BatchMode=yes $ServerHost "ls -t $ServerSrc/uploads-*.tar.gz 2>/dev/null | head -1" 2>&1
if ($latestUp) { $latestUp = $latestUp.Trim() }

Write-Log "Свежий БД-бэкап: $latestDb"
if ($latestUp) { Write-Log "Свежий uploads: $latestUp" }

# ── 3. Скачиваем через scp ───────────────────────────────────────────────────
$dbName = Split-Path $latestDb -Leaf
$localDb = Join-Path $LocalDest $dbName
& scp -q "${ServerHost}:${latestDb}" "$localDb"
if ($LASTEXITCODE -ne 0) {
    Write-Log "ОШИБКА: scp базы не сработал"
    exit 1
}
$dbSize = [math]::Round((Get-Item $localDb).Length / 1KB, 1)
Write-Log "Скачано: $dbName ($dbSize KB)"

if ($latestUp) {
    $upName = Split-Path $latestUp -Leaf
    $localUp = Join-Path $LocalDest $upName
    & scp -q "${ServerHost}:${latestUp}" "$localUp"
    if ($LASTEXITCODE -eq 0) {
        $upSize = [math]::Round((Get-Item $localUp).Length / 1MB, 2)
        Write-Log "Скачано: $upName ($upSize MB)"
    } else {
        Write-Log "ПРЕДУПРЕЖДЕНИЕ: scp uploads не сработал"
    }
}

# ── 4. Чистим старые локальные копии ─────────────────────────────────────────
Get-ChildItem -Path $LocalDest -Filter "prod-*.db" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepCount |
    Remove-Item -Force
Get-ChildItem -Path $LocalDest -Filter "uploads-*.tar.gz" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepCount |
    Remove-Item -Force

$count = (Get-ChildItem -Path $LocalDest -Filter "prod-*.db").Count
Write-Log "Локально хранится $count бэкапов БД. Лимит: $KeepCount"
Write-Log "─── Готово ───"
