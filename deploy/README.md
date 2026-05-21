# Деплой CRM RUTEST на VPS (Ubuntu 22.04)

Гайд по первоначальному развёртыванию CRM на собственном сервере.

---

## Шаг 1. Подготовка локально

Репозиторий уже на GitHub: https://github.com/gajexara13-sys/crm-b2b-equipment

Если есть несинхронизированные изменения — закоммить и запушь:
```powershell
git add .
git commit -m "что изменилось"
git push
```

---

## Шаг 2. Заказ VPS

Любой провайдер с Ubuntu 22.04:
- **Selectel** — https://selectel.ru/services/cloud/servers/
- **Timeweb Cloud** — https://timeweb.cloud/
- **Reg.ru Cloud**, **Yandex Cloud**, **Hetzner**, **DigitalOcean** — всё подойдёт

Минимальная конфигурация: **2 CPU / 2 GB RAM / 20 GB SSD**, Ubuntu 22.04 LTS.

После создания у тебя будет:
- IP-адрес сервера
- Логин (обычно `root`) и пароль (или SSH-ключ)

---

## Шаг 3. DNS — направить поддомен на сервер

В панели SpaceWeb → **Домены → rutestin.com → DNS-записи**:

| Имя | Тип | Значение            | TTL  |
|-----|-----|---------------------|------|
| crm | A   | `<IP твоего VPS>`   | 3600 |

Проверь, что запись поехала (на локалке):
```bash
nslookup crm.rutestin.com
```
Должен ответить твой IP. Может занять 5–30 минут.

---

## Шаг 4. Подключение к серверу

С Windows — через **PowerShell** или **PuTTY**:
```bash
ssh root@<IP-сервера>
```

---

## Шаг 5. Установка CRM

На сервере выполни:
```bash
# Скачиваем установочный скрипт
curl -fsSL https://raw.githubusercontent.com/gajexara13-sys/crm-b2b-equipment/main/deploy/install.sh -o install.sh

# Запускаем
sudo CRM_DOMAIN=crm.rutestin.com bash install.sh
```

Скрипт сам:
- поставит Python, Node.js, Nginx, Certbot
- создаст пользователя `crm` и каталоги
- склонирует репозиторий в `/opt/crm`
- соберёт frontend, поставит backend-зависимости
- сгенерирует `SECRET_KEY` для JWT
- запустит backend через systemd
- настроит Nginx
- включит файрвол и cron-бэкап

После завершения скрипт подскажет следующие шаги.

---

## Шаг 6. SSL-сертификат

```bash
sudo certbot --nginx -d crm.rutestin.com
```

Certbot спросит email, согласие с условиями. После — пропишет HTTPS-конфиг автоматически. Сертификат бесплатный, обновляется автоматически каждые 60 дней.

---

## Шаг 7. Открыть в браузере

https://crm.rutestin.com

Войти под админом (`admin@crm.local` / тот пароль, который был задан в локальной БД).

**⚠ Сразу смени пароль администратора!**

---

## Обновление CRM (когда дописал что-то новое)

На локалке:
```bash
git add .
git commit -m "..."
git push
```

На сервере:
```bash
ssh root@<IP>
sudo bash /opt/crm/deploy/deploy.sh
```

Скрипт сам подтянет изменения, поставит новые зависимости (если есть), пересоберёт фронт и перезапустит сервисы. Простоя меньше секунды.

---

## Что где лежит на сервере

| Путь                           | Что это                               |
|--------------------------------|---------------------------------------|
| `/opt/crm/`                    | Весь репозиторий                     |
| `/opt/crm/.env`                | Секреты (SECRET_KEY и пр.)            |
| `/opt/crm/data/prod.db`        | Боевая SQLite-база                    |
| `/opt/crm/data/backups/`       | Ежедневные бэкапы (14 дней)           |
| `/opt/crm/backend/uploads/`    | Загруженные файлы (фото, логотипы)    |
| `/opt/crm/venv/`               | Python-окружение                      |
| `/opt/crm/frontend/dist/`      | Собранный фронт (раздаётся Nginx)     |
| `/var/log/crm/`                | Логи backend                          |
| `/var/log/nginx/crm.*.log`     | Логи nginx                            |

---

## Полезные команды

```bash
# Статус backend
systemctl status crm-backend

# Логи backend (live)
sudo journalctl -u crm-backend -f
# или
tail -f /var/log/crm/backend.log

# Логи nginx
tail -f /var/log/nginx/crm.access.log
tail -f /var/log/nginx/crm.error.log

# Перезапуск backend
sudo systemctl restart crm-backend

# Ручной бэкап БД
sudo /usr/local/bin/crm-backup-db
ls -lh /opt/crm/data/backups/

# Список бэкапов
ls -lh /opt/crm/data/backups/

# Восстановление из бэкапа
sudo systemctl stop crm-backend
sudo cp /opt/crm/data/backups/prod-ДАТА.db /opt/crm/data/prod.db
sudo chown crm:crm /opt/crm/data/prod.db
sudo systemctl start crm-backend
```

---

## Скачивание бэкапа с сервера на свой ПК (для надёжности)

С Windows-машины:
```powershell
scp root@<IP>:/opt/crm/data/backups/prod-*.db D:\backups\
```

Или настрой автоматическую отправку в облако (Yandex S3, Backblaze B2) — могу подготовить скрипт.

---

## Известные ограничения текущей версии

1. **PDF-экспорт КП временно отключён** (использовался MS Word через COM, не работает на Linux). Если понадобится — поставим LibreOffice и переключим на него.
2. **БД SQLite** — на текущем этапе хватает для 1–3 одновременных пользователей. При росте команды до 5+ человек надо мигрировать на PostgreSQL.
3. **Email-уведомления** не настроены.
