-- Приведение схемы к рабочему состоянию: то, что раньше вносилось вручную или скриптами.
-- Все операции идемпотентны: на базе, где они уже выполнены, миграция ничего не меняет.

-- 1. Источник станции: 'analytics' — из схемы azs (синхронизируется), 'manual' — создана в приложении.
--    Раньше колонка добавлялась в _data/_BD/pipeline/sync_public.sql; теперь она описана здесь.
ALTER TABLE azs ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'analytics';
ALTER TABLE azs ALTER COLUMN source SET DEFAULT 'manual';

-- 2. Журнал импорта: типы совпадают с ImportType в backend/src/services/import.service.ts.
ALTER TABLE import_history DROP CONSTRAINT IF EXISTS import_history_import_type_check;
ALTER TABLE import_history ADD CONSTRAINT import_history_import_type_check
  CHECK (import_type IN ('stations', 'prices', 'traffic', 'weather', 'competitors', 'shop', 'promotions'));

-- 3. Устаревшие таблицы из первоначальной схемы. Приложение и аналитика читают данные из схемы azs,
--    а этим таблицам соответствует только мёртвый код database/import-data-content.ts.
DROP TABLE IF EXISTS promotions, shop_sales, traffic_data;
