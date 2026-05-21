#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Обновление CRM после git push.
# Запускать на сервере: cd /opt/crm && sudo bash deploy/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

INSTALL_DIR="/opt/crm"
cd "$INSTALL_DIR"

if [[ $EUID -ne 0 ]]; then
  echo "Запусти от root: sudo bash deploy/deploy.sh"
  exit 1
fi

echo "▶ Получение свежей версии из git…"
sudo -u crm git fetch --all --prune
sudo -u crm git reset --hard origin/main

echo "▶ Обновление python-зависимостей…"
sudo -u crm "$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/backend/requirements.txt"

echo "▶ Пересборка фронтенда…"
cd "$INSTALL_DIR/frontend"
sudo -u crm npm install --no-audit --no-fund
sudo -u crm npm run build

echo "▶ Перезапуск backend…"
systemctl restart crm-backend
sleep 2

echo "▶ Перезагрузка nginx…"
nginx -t && systemctl reload nginx

echo ""
echo "✓ Обновление готово."
echo "  Статус backend: systemctl status crm-backend --no-pager"
echo "  Логи:          tail -f /var/log/crm/backend.log"
