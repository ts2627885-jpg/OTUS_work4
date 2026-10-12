-- Удаление города АЗС: город не подтвержден источниками данных, поле снимается полностью.
-- Регион (location_region) сохраняется.
DROP INDEX IF EXISTS idx_azs_location_city;
ALTER TABLE azs DROP COLUMN IF EXISTS location_city;
