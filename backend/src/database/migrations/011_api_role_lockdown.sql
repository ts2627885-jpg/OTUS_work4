-- Закрытие доступа к схеме public для ролей публичного API (Supabase: anon, authenticated, service_role).
-- На Supabase по умолчанию эти роли получают полный доступ ко всем новым таблицам; без отзыва прав
-- таблица users (хеши паролей) была бы доступна через публичный ключ.
-- Приложение ходит в базу под ролью azs_app, роли API здесь не нужны.
-- На self-hosted этих ролей нет, блок пропускается.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      -- Права по умолчанию для объектов, которые создаст postgres (миграции)
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
