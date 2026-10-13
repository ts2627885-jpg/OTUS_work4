-- Журнал предупреждений и ошибок приложения (для Supabase, см. utils/db-log-sink.ts; включается LOG_TO_DB=true).
-- Записи пишет бэкенд фоново, без контекста пользователя, поэтому вставка разрешена всем;
-- читать журнал может только admin.
CREATE TABLE IF NOT EXISTS app_logs (
  id            bigserial PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  level         varchar(10) NOT NULL CHECK (level IN ('warn', 'error')),
  context       varchar(100),
  message       text NOT NULL,
  data          jsonb,
  error_name    varchar(100),
  error_message text
);

CREATE INDEX IF NOT EXISTS app_logs_created_idx ON app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_level_idx ON app_logs (level, created_at DESC);

ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_logs_insert ON app_logs;
CREATE POLICY app_logs_insert ON app_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS app_logs_admin_select ON app_logs;
CREATE POLICY app_logs_admin_select ON app_logs FOR SELECT USING (app_role() = 'admin');
