-- Row Level Security: доступ по станциям на уровне базы.
-- Контекст на каждый запрос задаёт приложение (set_config):
--   app.role     — admin | analyst | viewer | manager (без значения — строки не видны)
--   app.user_id  — uuid пользователя (нужен для manager: станции из azs_access)
-- Правила совпадают с backend/src/services/access.service.ts:
--   admin, analyst, viewer — все станции; manager — только назначенные.
-- Владелец таблиц (postgres) политики не ограничивают; их применяет роль приложения azs_app
-- (без BYPASSRLS). Роль, которая обходит RLS, создать нельзя — пусть так и остаётся.

-- ---------- Вспомогательные функции ----------

CREATE OR REPLACE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.role', true), '') $$;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

-- Есть ли у текущего контекста доступ к станции
CREATE OR REPLACE FUNCTION app_station_ok(station uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN app_role() IN ('admin', 'analyst', 'viewer') THEN true
    WHEN app_role() = 'manager' THEN station IS NOT NULL AND EXISTS (
      SELECT 1 FROM azs_access a WHERE a.user_id = app_user_id() AND a.azs_id = station)
    ELSE false
  END
$$;

-- ---------- azs: станции ----------
ALTER TABLE azs ENABLE ROW LEVEL SECURITY;
CREATE POLICY azs_select ON azs FOR SELECT USING (app_station_ok(id));
CREATE POLICY azs_admin_write ON azs FOR ALL
  USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

-- ---------- azs_access: назначения менеджеров ----------
ALTER TABLE azs_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY azs_access_select ON azs_access FOR SELECT
  USING (app_role() = 'admin' OR user_id = app_user_id());
CREATE POLICY azs_access_admin_write ON azs_access FOR ALL
  USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

-- ---------- Данные по станциям: чтение по станции, запись admin или manager своей станции ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prices', 'price_history', 'recommendations', 'sales_data',
                           'weather_data', 'competitor_prices'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (app_station_ok(azs_id))', t || '_select', t);
    EXECUTE format($f$CREATE POLICY %I ON %I FOR ALL
      USING (app_role() = 'admin' OR (app_role() = 'manager' AND app_station_ok(azs_id)))
      WITH CHECK (app_role() = 'admin' OR (app_role() = 'manager' AND app_station_ok(azs_id)))$f$,
      t || '_write', t);
  END LOOP;
END $$;

-- ---------- План теста цен: station_code (char 3), не azs_id ----------
-- Привязки к станции по коду в базе нет, поэтому читают admin, analyst и manager (без фильтра по станции).
ALTER TABLE price_test_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_test_plan_select ON price_test_plan FOR SELECT
  USING (app_role() IN ('admin', 'analyst', 'manager'));
CREATE POLICY price_test_plan_admin_write ON price_test_plan FOR ALL
  USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

-- ---------- Пользователи: читать может любой контекст (вход по логину), менять — admin ----------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON users FOR SELECT USING (app_role() IS NOT NULL);
CREATE POLICY users_admin_write ON users FOR ALL
  USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
-- Публичная регистрация (POST /api/auth/register): контекст anonymous, роль только viewer
CREATE POLICY users_register ON users FOR INSERT
  WITH CHECK (app_role() = 'anonymous' AND role = 'viewer');

-- ---------- Журналы: писать может любой контекст, читать — admin ----------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (app_role() IS NOT NULL);
CREATE POLICY audit_logs_admin_select ON audit_logs FOR SELECT USING (app_role() = 'admin');

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY login_logs_insert ON login_logs FOR INSERT WITH CHECK (app_role() IS NOT NULL);
CREATE POLICY login_logs_admin_select ON login_logs FOR SELECT USING (app_role() = 'admin');

-- ---------- Настройки расчёта и журнал импорта: читать — любой контекст, менять — admin ----------
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_select ON app_settings FOR SELECT USING (app_role() IS NOT NULL);
CREATE POLICY app_settings_admin_write ON app_settings FOR ALL
  USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_history_admin ON import_history FOR ALL
  USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
