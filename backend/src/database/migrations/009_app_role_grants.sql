-- Права роли приложения azs_app на схему аналитики azs (таблицы создаёт пайплайн от имени postgres).
-- Выполняется только если роль существует (её создаёт db/initdb/01-app-role.sh или вручную на Supabase)
-- и схема azs уже загружена пайплайном. Если схемы нет, миграция ничего не делает:
-- права выдаются после загрузки azs: выполнить этот блок повторно вручную (тот же SQL).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azs_app') AND to_regnamespace('azs') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE ON SCHEMA azs TO azs_app';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA azs TO azs_app';
    -- Пайплайн пересоздаёт схему azs (DROP SCHEMA CASCADE): права на новые таблицы выдаём по умолчанию
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA azs GRANT SELECT ON TABLES TO azs_app';
  END IF;
END $$;
