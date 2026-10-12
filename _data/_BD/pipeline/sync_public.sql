-- Синхронизация схемы public (приложение АЗС-Пульт) со схемой azs (аналитика).
-- Запускается пайплайном после post.sql и после каждой загрузки CSV через интерфейс.
-- Станции совпадают по названию: существующие UUID сохраняются.
-- public.azs.source: 'analytics' — станция из azs (синхронизируется и может быть удалена при исчезновении из azs);
-- 'manual' — создана в приложении вручную (синхронизация её не трогает).
BEGIN;

-- Существующие строки до появления колонки создавались только синхронизацией, поэтому получают 'analytics'.
-- Новые строки без явного значения (создание через API) — 'manual'.
ALTER TABLE public.azs ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'analytics';
ALTER TABLE public.azs ALTER COLUMN source SET DEFAULT 'manual';

-- Станции из azs и виды топлива в формате приложения (AI92 -> A92)
CREATE TEMP TABLE st AS
SELECT s.station_code, s.station_name, s.road_type,
       COALESCE((SELECT array_agg(DISTINCT regexp_replace(f.fuel_code, '^AI', 'A'))
          FROM azs.fuel_daily f
         WHERE f.station_code = s.station_code AND f.sales_volume > 0), '{}') AS fuels
FROM azs.station s;

-- Удаляем станции из аналитики, которых нет в новой выгрузке, и всё, что на них ссылается.
-- Станции, созданные вручную (source = 'manual'), не трогаем.
DELETE FROM public.recommendations WHERE azs_id IN
  (SELECT id FROM public.azs WHERE source = 'analytics' AND name NOT IN (SELECT station_name FROM st));
DELETE FROM public.azs_access WHERE azs_id IN
  (SELECT id FROM public.azs WHERE source = 'analytics' AND name NOT IN (SELECT station_name FROM st));
DELETE FROM public.price_test_plan WHERE btrim(station_code::text) NOT IN (SELECT station_code FROM st);
DELETE FROM public.azs WHERE source = 'analytics' AND name NOT IN (SELECT station_name FROM st);

-- Добавляем новые АЗС из аналитики
-- region в выгрузке нет (NOT NULL): берём регион, который уже стоит у АЗС в приложении
INSERT INTO public.azs (name, address, region, fuel_types, status, source, created_at, updated_at)
SELECT s.station_name, s.road_type, 'Tver region', s.fuels, 'active', 'analytics', now(), now()
FROM st s
WHERE NOT EXISTS (SELECT 1 FROM public.azs a WHERE a.name = s.station_name);

-- Станции из аналитики помечаются источником (в том числе уже существующие с тем же названием)
UPDATE public.azs a SET source = 'analytics'
FROM st s WHERE a.name = s.station_name AND a.source <> 'analytics';

-- Соответствие station_code (azs) -> id (public)
CREATE TEMP TABLE sm AS
SELECT s.station_code, a.id AS azs_id
FROM st s JOIN public.azs a ON a.name = s.station_name;

-- Данные приложения заменяются целиком
DELETE FROM public.prices;
DELETE FROM public.sales_data;
DELETE FROM public.weather_data;
DELETE FROM public.competitor_prices;

-- Текущая цена: последняя известная на каждую пару АЗС + топливо
INSERT INTO public.prices (azs_id, fuel_type, price, trend, previous_price, updated_at)
SELECT DISTINCT ON (sm.azs_id, f.fk)
       sm.azs_id, f.fk, f.price, NULL, NULL, f.sale_date::timestamp
FROM (SELECT x.*, regexp_replace(x.fuel_code, '^AI', 'A') AS fk
        FROM azs.fuel_daily x WHERE x.price IS NOT NULL AND x.price > 0) f
JOIN sm ON sm.station_code = f.station_code
ORDER BY sm.azs_id, f.fk, f.sale_date DESC;

-- Продажи по дням
INSERT INTO public.sales_data (azs_id, fuel_type, volume, revenue, date_recorded)
SELECT sm.azs_id, regexp_replace(f.fuel_code, '^AI', 'A'), f.sales_volume,
       round(f.sales_volume * COALESCE(f.price, 0), 2), f.sale_date
FROM azs.fuel_daily f
JOIN sm ON sm.station_code = f.station_code
WHERE f.sales_volume IS NOT NULL;

-- Погода
INSERT INTO public.weather_data (azs_id, temperature, humidity, wind_speed, conditions, date_recorded)
SELECT sm.azs_id, w.temperature_c, w.humidity_pct, w.wind_speed_ms, w.weather_type, w.weather_date::timestamp
FROM azs.weather_daily w
JOIN sm ON sm.station_code = w.station_code;

-- Цены конкурентов (только предлагаемые)
INSERT INTO public.competitor_prices (azs_id, competitor_name, fuel_type, price, distance_km, last_updated)
SELECT sm.azs_id, c.brand, regexp_replace(cp.fuel_code, '^AI', 'A'), cp.price, NULL, cp.observed_at
FROM azs.competitor_price cp
JOIN azs.competitor c ON c.competitor_id = cp.competitor_id
JOIN sm ON sm.station_code = c.station_code
WHERE cp.is_offered AND cp.price IS NOT NULL;

COMMIT;
