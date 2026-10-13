-- Права роли приложения azs_app на схему public в ТЕКУЩЕЙ базе.
-- Роль создаётся один раз на сервере, а права по умолчанию (ALTER DEFAULT PRIVILEGES) действуют только
-- в той базе, где их задали. Поэтому новая база (с другим именем) без этой миграции даёт
-- «permission denied for table users» при первом входе.
-- Выполняется только если роль azs_app существует; идемпотентна.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azs_app') THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO azs_app', current_database());
    EXECUTE 'GRANT USAGE ON SCHEMA public TO azs_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO azs_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO azs_app';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO azs_app';
    -- Права на объекты, которые появятся позже (миграции выполняет владелец)
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO azs_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO azs_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO azs_app';
  END IF;
END $$;
