# ─────────────────────────────────────────────────────────────────────────────
# CRM RUTEST — восстановление БД из локального бэкапа на сервер.
#
# Использование:
#   .\backup-restore.ps1                          # последний по дате бэкап
#   .\backup-restore.ps1 prod-2026-05-22_03-00-15.db   # конкретный
# ─────────────────────────────────────────────────────────────────────────────

param([string]$BackupFile = "")

$ServerHost  = "root@31.177.82.167"
$LocalDest   = "C:\CRM-Backups"
$ServerData  = "/opt/crm/data/prod.db"

if (-not $BackupFile) {
    $latest = Get-ChildItem -Path $LocalDest -Filter "prod-*.db" |
              Sort-Object LastWriteTime -Descending |
              Select-Object -First 1
    if (-not $latest) {
        Write-Host "Не найдено локальных бэкапов в $LocalDest" -ForegroundColor Red
        exit 1
    }
    $BackupFile = $latest.Name
}

$localPath = Join-Path $LocalDest $BackupFile
if (-not (Test-Path $localPath)) {
    Write-Host "Файл не найден: $localPath" -ForegroundColor Red
    exit 1
}

Write-Host "Восстановление из: $localPath" -ForegroundColor Cyan
Write-Host "Это перезапишет рабочую БД на сервере! Продолжить? (y/N) " -ForegroundColor Yellow -NoNewline
$ans = Read-Host
if ($ans -ne "y" -and $ans -ne "Y") {
    Write-Host "Отмена"
    exit 0
}

Write-Host "→ Останавливаем backend..."
ssh $ServerHost "sudo systemctl stop crm-backend"

Write-Host "→ Бэкапим текущую БД на сервере..."
$ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
ssh $ServerHost "sudo cp $ServerData ${ServerData}.before_restore_$ts 2>/dev/null || true"

Write-Host "→ Загружаем бэкап..."
scp $localPath "${ServerHost}:/tmp/restore.db"
ssh $ServerHost "sudo mv /tmp/restore.db $ServerData && sudo chown crm:crm $ServerData"

Write-Host "→ Запускаем backend..."
ssh $ServerHost "sudo systemctl start crm-backend"
Start-Sleep -Seconds 2
ssh $ServerHost "sudo systemctl status crm-backend --no-pager | head -5"

Write-Host "`n✓ Готово. Откройте https://crm.rutestin.com" -ForegroundColor Green
