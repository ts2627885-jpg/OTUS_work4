-- Резервная копия (pg_dump) читает и последовательности схемы azs; роли приложения нужно право SELECT на них.
-- Миграция 009 выдала права только на таблицы. Выполняется только если роль и схема существуют.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azs_app') AND to_regnamespace('azs') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON ALL SEQUENCES IN SCHEMA azs TO azs_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA azs GRANT SELECT ON SEQUENCES TO azs_app';
  END IF;
END $$;
