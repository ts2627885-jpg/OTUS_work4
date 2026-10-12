-- Журнал рекомендаций: сохранение результатов правил, статусы и отметка «выполнено».
-- Тип теперь код правила (PRICE-001 и т. п.), цены и станция могут быть пустыми
-- (правила сети, например PROMO-003, не привязаны к станции).
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_type_check;
ALTER TABLE recommendations
  ALTER COLUMN azs_id DROP NOT NULL,
  ALTER COLUMN fuel_type DROP NOT NULL,
  ALTER COLUMN current_price DROP NOT NULL,
  ALTER COLUMN recommended_price DROP NOT NULL;
ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS rule_id varchar(20),
  ADD COLUMN IF NOT EXISTS priority varchar(10),
  ADD COLUMN IF NOT EXISTS title varchar(200),
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS effect text,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dedupe_key varchar(200);
CREATE UNIQUE INDEX IF NOT EXISTS recommendations_dedupe_key_uidx ON recommendations (dedupe_key);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_priority_check') THEN
    ALTER TABLE recommendations ADD CONSTRAINT recommendations_priority_check
      CHECK (priority IN ('URGENT', 'HIGH', 'MEDIUM', 'LOW'));
  END IF;
END $$;
