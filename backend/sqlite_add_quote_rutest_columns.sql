-- SQLite: новые поля для блока условий в экспорте КП (если таблица уже создана без них).
ALTER TABLE commercial_quotes ADD COLUMN terms_price_validity TEXT;
ALTER TABLE commercial_quotes ADD COLUMN terms_lead_time TEXT;
