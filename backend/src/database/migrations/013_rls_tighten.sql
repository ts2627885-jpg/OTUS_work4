-- RLS: ужесточение после проверки политик.
-- 1. users: читать могут admin и своя строка; контекст anonymous — только для входа и регистрации.
--    Раньше любой контекст видел всех пользователей, включая password_hash.
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT
  USING (app_role() = 'admin' OR id = app_user_id() OR app_role() = 'anonymous');

-- 2. Сетевые рекомендации (azs_id IS NULL) — только для аутентифицированных ролей, не для anonymous.
DROP POLICY IF EXISTS recommendations_select ON recommendations;
CREATE POLICY recommendations_select ON recommendations FOR SELECT
  USING (app_station_ok(azs_id)
         OR (azs_id IS NULL AND app_role() IN ('admin', 'manager', 'analyst', 'viewer')));

-- 3. Настройки расчёта — только для аутентифицированных ролей.
DROP POLICY IF EXISTS app_settings_select ON app_settings;
CREATE POLICY app_settings_select ON app_settings FOR SELECT
  USING (app_role() IN ('admin', 'manager', 'analyst', 'viewer'));

-- 4. schema_migrations — служебная таблица раннера: закрыть для всех ролей приложения.
--    Без политик ролям приложения доступа нет; раннер работает под владельцем (postgres).
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
