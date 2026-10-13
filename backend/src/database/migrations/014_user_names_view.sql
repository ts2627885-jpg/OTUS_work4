-- Имена пользователей для отображения (например, кто закрыл рекомендацию).
-- Представление читает таблицу users от владельца (postgres) и отдаёт только id и username,
-- поэтому роли приложения видят имена, но не хеши паролей и роли.
CREATE OR REPLACE VIEW user_names AS
  SELECT id, username FROM users;

REVOKE ALL ON user_names FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azs_app') THEN
    EXECUTE 'GRANT SELECT ON user_names TO azs_app';
  END IF;
  -- Роли публичного API не должны видеть даже имена (миграция 011 закрыла таблицы, представление новое)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON user_names FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON user_names FROM authenticated';
  END IF;
END $$;
