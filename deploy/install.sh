#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Первоначальная установка CRM RUTEST на чистый Ubuntu 22.04 VPS.
# Запускать ОТ ROOT (или через sudo). После первого запуска не запускать повторно.
#
# Что делает:
#   1. Обновляет систему и ставит пакеты (Python, Node, Nginx, Certbot, Git)
#   2. Создаёт системного пользователя crm и каталоги
#   3. Клонирует репозиторий в /opt/crm
#   4. Создаёт venv, ставит зависимости backend
#   5. Билдит frontend
#   6. Кладёт systemd-unit, nginx-конфиг, .env (шаблон)
#   7. Запускает backend и nginx
#   8. Подсказывает следующие шаги (certbot, заполнение .env)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ────── Параметры ──────────────────────────────────────────────────────────
DOMAIN="${CRM_DOMAIN:-crm.rutestin.com}"
REPO_URL="${REPO_URL:-https://github.com/gajexara13-sys/crm-b2b-equipment.git}"
INSTALL_DIR="/opt/crm"
DATA_DIR="$INSTALL_DIR/data"
LOG_DIR="/var/log/crm"

if [[ $EUID -ne 0 ]]; then
  echo "Запусти от root: sudo bash install.sh"
  exit 1
fi

echo "▶ Обновление системы…"
apt-get update -y
apt-get upgrade -y

echo "▶ Установка пакетов…"
apt-get install -y \
  python3 python3-venv python3-pip \
  nginx certbot python3-certbot-nginx \
  git curl ca-certificates ufw \
  sqlite3

# Node.js LTS (v20)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "▶ Создание пользователя crm и каталога логов…"
id -u crm &>/dev/null || useradd --system --create-home --shell /bin/bash crm
mkdir -p "$LOG_DIR"
chown -R crm:crm "$LOG_DIR"

echo "▶ Клонирование репозитория…"
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  # Если каталог уже существует (например, после неудачной попытки) — очищаем
  if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
  fi
  # Создаём пустую папку и отдаём пользователю crm, чтобы git clone сработал
  mkdir -p "$INSTALL_DIR"
  chown crm:crm "$INSTALL_DIR"
  sudo -u crm git clone "$REPO_URL" "$INSTALL_DIR"
else
  echo "  Репозиторий уже склонирован."
fi

# Папка для БД создаётся после клона, чтобы не мешать git clone
mkdir -p "$DATA_DIR"
chown -R crm:crm "$INSTALL_DIR" "$DATA_DIR"

echo "▶ Python venv + зависимости backend…"
if [[ ! -d "$INSTALL_DIR/venv" ]]; then
  sudo -u crm python3 -m venv "$INSTALL_DIR/venv"
fi
sudo -u crm "$INSTALL_DIR/venv/bin/pip" install --upgrade pip wheel
sudo -u crm "$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/backend/requirements.txt"

echo "▶ Сборка фронтенда…"
cd "$INSTALL_DIR/frontend"
sudo -u crm npm install --no-audit --no-fund
sudo -u crm npm run build

echo "▶ Настройка .env (если ещё не создан)…"
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  cp "$INSTALL_DIR/deploy/env.example" "$INSTALL_DIR/.env"
  # Генерируем SECRET_KEY
  SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
  sed -i "s|CHANGE_ME_GENERATE_LONG_RANDOM_STRING|$SECRET|g" "$INSTALL_DIR/.env"
  sed -i "s|crm.rutestin.com|$DOMAIN|g" "$INSTALL_DIR/.env"
  chown crm:crm "$INSTALL_DIR/.env"
  chmod 600 "$INSTALL_DIR/.env"
fi

echo "▶ systemd unit для backend…"
cp "$INSTALL_DIR/deploy/crm-backend.service" /etc/systemd/system/crm-backend.service
systemctl daemon-reload
systemctl enable crm-backend

echo "▶ Nginx-конфиг…"
cp "$INSTALL_DIR/deploy/nginx-crm.conf" /etc/nginx/sites-available/crm
# Подставляем домен
sed -i "s|crm.rutestin.com|$DOMAIN|g" /etc/nginx/sites-available/crm
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/certbot
nginx -t
systemctl reload nginx

echo "▶ Cron для бэкапа БД…"
cp "$INSTALL_DIR/deploy/backup-db.sh" /usr/local/bin/crm-backup-db
chmod +x /usr/local/bin/crm-backup-db
# 03:00 каждый день
( crontab -l 2>/dev/null | grep -v crm-backup-db; echo "0 3 * * * /usr/local/bin/crm-backup-db" ) | crontab -

echo "▶ Файрвол (UFW)…"
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

echo "▶ Запуск backend…"
systemctl restart crm-backend
sleep 2
systemctl status crm-backend --no-pager || true

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "✓ Установка завершена."
echo ""
echo "Дальше нужно:"
echo ""
echo "1. Убедиться, что A-запись $DOMAIN указывает на этот сервер."
echo "   Проверить: dig +short $DOMAIN"
echo ""
echo "2. Получить SSL-сертификат от Let's Encrypt:"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""
echo "3. Открыть в браузере: https://$DOMAIN"
echo ""
echo "Логи backend:  tail -f /var/log/crm/backend.log"
echo "Логи nginx:    tail -f /var/log/nginx/crm.access.log"
echo "Перезапуск:    sudo systemctl restart crm-backend"
echo "════════════════════════════════════════════════════════════════════"
