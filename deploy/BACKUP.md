# Резервное копирование CRM

## Текущая схема

```
[Сервер VPS]                                 [Твой ПК]
  /opt/crm/data/prod.db ──┐
                          │
  cron (ежедневно 03:00)  │
        ↓                 │
  /opt/crm/data/backups/  │   ← хранится 14 копий БД + uploads (tar.gz)
                          │
                          ↓
                    PowerShell-скрипт
                    backup-pull.ps1
                          ↓
                  C:\CRM-Backups\        ← хранится 30 копий
```

То есть **3 уровня защиты:**
1. **На сервере, cron 03:00** — копии в `/opt/crm/data/backups/` (14 дней)
2. **На твоём ПК** — копии в `C:\CRM-Backups\` (30 дней) — для случая, если VPS улетит
3. **Опционально:** ручная отправка в Telegram / Yandex.Disk / etc.

---

## Однократная настройка автоматического забора

### 1. Запусти один раз вручную — проверить, что работает

```powershell
cd C:\Users\user\Documents\GitHub\crm-b2b-equipment
powershell -ExecutionPolicy Bypass -File deploy\backup-pull.ps1
```

Если всё ок — в `C:\CRM-Backups\` появятся файлы `prod-YYYY-MM-DD_HH-MM-SS.db` и `uploads-...tar.gz`, а в `C:\CRM-Backups\backup.log` — лог.

### 2. Настроить запуск каждый день через Планировщик задач

1. **Win+R → `taskschd.msc` → Enter**
2. Правой кнопкой по «Библиотека планировщика заданий» → **«Создать задачу»**
3. Вкладка **Общие**:
   - Имя: `CRM Backup Pull`
   - Описание: `Ежедневная загрузка бэкапа CRM с сервера`
   - ☑ Выполнять для всех пользователей
   - ☑ Выполнять с наивысшими правами
4. Вкладка **Триггеры → Создать**:
   - Запуск: По расписанию
   - Ежедневно, в 21:00
   - ☑ Включено
5. Вкладка **Действия → Создать**:
   - Программа: `powershell.exe`
   - Аргументы:
     ```
     -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\user\Documents\GitHub\crm-b2b-equipment\deploy\backup-pull.ps1"
     ```
   - Папка: `C:\Users\user\Documents\GitHub\crm-b2b-equipment`
6. Вкладка **Условия**:
   - ☐ Запускать только при питании от сети (снять — чтобы работало и на ноутбуке)
   - ☑ Запускать задачу, если пропущенное время > 1 час (на случай если ПК был выключен)
7. Вкладка **Параметры**:
   - ☑ Выполнить как можно раньше после пропуска
   - ☑ Если задача не завершилась — остановить через 1 час
8. **ОК** → ввести пароль Windows-учётки

Готово. Каждый день в 21:00 (или при первом включении ПК) свежий бэкап будет автоматически приезжать.

### 3. Проверка работы задачи

```powershell
Get-Content C:\CRM-Backups\backup.log -Tail 20
```
или открой `C:\CRM-Backups\backup.log` в Блокноте.

---

## Восстановление из бэкапа

### Из локальной копии — обратно на сервер

```powershell
cd C:\Users\user\Documents\GitHub\crm-b2b-equipment
.\deploy\backup-restore.ps1
```

Скрипт:
- Найдёт **самый свежий** бэкап в `C:\CRM-Backups\`
- Спросит подтверждение
- Остановит backend
- Создаст копию текущей БД (`prod.db.before_restore_YYYY-MM-DD_HH-MM-SS`)
- Загрузит локальный бэкап на сервер
- Запустит backend

### Из конкретного бэкапа

```powershell
.\deploy\backup-restore.ps1 -BackupFile "prod-2026-05-22_03-00-15.db"
```

---

## Управление количеством хранимых копий

В `deploy\backup-pull.ps1` параметр `$KeepCount = 30` — измени на нужное.
На сервере в `/usr/local/bin/crm-backup-db` — `KEEP_DAYS=14` (тоже можно увеличить).
