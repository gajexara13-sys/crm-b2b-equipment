#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Бэкап SQLite-базы CRM. Хранит 14 последних копий.
# Запускается из cron: 0 3 * * * /usr/local/bin/crm-backup-db
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SRC="/opt/crm/data/prod.db"
DEST_DIR="/opt/crm/data/backups"
KEEP_DAYS=14
TS=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$DEST_DIR"

if [[ ! -f "$SRC" ]]; then
  echo "[$TS] backup: исходный файл $SRC не найден" >&2
  exit 1
fi

# Используем sqlite3 .backup — корректно бэкапит даже когда БД открыта
sqlite3 "$SRC" ".backup '$DEST_DIR/prod-$TS.db'"

# Бэкапим uploads (если есть)
if [[ -d /opt/crm/backend/uploads ]]; then
  tar -czf "$DEST_DIR/uploads-$TS.tar.gz" -C /opt/crm/backend uploads
fi

# Чистим старые бэкапы
find "$DEST_DIR" -name "prod-*.db"          -mtime +$KEEP_DAYS -delete
find "$DEST_DIR" -name "uploads-*.tar.gz"   -mtime +$KEEP_DAYS -delete

echo "[$TS] backup OK: prod-$TS.db"
