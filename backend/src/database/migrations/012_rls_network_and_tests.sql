-- RLS: рекомендации сети и планы теста цен.

-- 1. Рекомендации без станции (правила сети, azs_id IS NULL) видят все роли с контекстом.
--    Менять такие строки может только admin: политика записи (010_rls) для NULL даёт доступ только admin.
DROP POLICY IF EXISTS recommendations_select ON recommendations;
CREATE POLICY recommendations_select ON recommendations FOR SELECT
  USING (app_station_ok(azs_id) OR (azs_id IS NULL AND app_role() IS NOT NULL));

-- 2. План теста цен привязываем к станции приложения (azs_id), а не только к коду аналитики.
ALTER TABLE price_test_plan ADD COLUMN IF NOT EXISTS azs_id uuid REFERENCES azs(id) ON DELETE CASCADE;

-- Заполняем по соответствию код аналитики -> имя станции -> public.azs.
-- Если схемы azs ещё нет (чистая база до пайплайна), пропускаем: в ней нет планов.
DO $$
BEGIN
  IF to_regclass('azs.station') IS NOT NULL THEN
    UPDATE price_test_plan p
       SET azs_id = a.id
      FROM azs.station s
      JOIN azs a ON a.name = s.station_name
     WHERE s.station_code = p.station_code AND p.azs_id IS NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS price_test_plan_select ON price_test_plan;
CREATE POLICY price_test_plan_select ON price_test_plan FOR SELECT
  USING (app_station_ok(azs_id));
-- Запись по-прежнему только admin (политика price_test_plan_admin_write из 010_rls)
