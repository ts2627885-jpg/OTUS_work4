SET search_path TO azs;
BEGIN;

-- 1. Цена 0 при продажах: предыдущее известное значение того же АЗС и топлива
WITH grp AS (
    SELECT station_code, sale_date, fuel_code, price,
           count(price) OVER (PARTITION BY station_code, fuel_code ORDER BY sale_date) AS g
    FROM fuel_daily
),
known AS (
    SELECT station_code, sale_date, fuel_code,
           max(price) OVER (PARTITION BY station_code, fuel_code, g) AS last_price
    FROM grp
)
UPDATE fuel_daily f
SET price = k.last_price, is_offered = TRUE, price_filled = TRUE, price_fill_method = 'prev'
FROM known k
WHERE f.station_code = k.station_code AND f.sale_date = k.sale_date AND f.fuel_code = k.fuel_code
  AND f.price IS NULL AND f.sales_volume > 0 AND k.last_price IS NOT NULL;

-- 2. Оставшиеся без предыдущего значения: следующее известное значение
UPDATE fuel_daily f
SET price = n.next_price, is_offered = TRUE, price_filled = TRUE, price_fill_method = 'next'
FROM (
    SELECT f2.station_code, f2.sale_date, f2.fuel_code,
           (SELECT f3.price FROM fuel_daily f3
             WHERE f3.station_code = f2.station_code AND f3.fuel_code = f2.fuel_code
               AND f3.sale_date > f2.sale_date AND f3.price IS NOT NULL
             ORDER BY f3.sale_date LIMIT 1) AS next_price
    FROM fuel_daily f2
    WHERE f2.price IS NULL AND f2.sales_volume > 0
) n
WHERE f.station_code = n.station_code AND f.sale_date = n.sale_date AND f.fuel_code = n.fuel_code
  AND n.next_price IS NOT NULL;

-- 3. Первый день трафика АЗС 172 неполный, исключается
DELETE FROM traffic_daily WHERE station_code = '172' AND traffic_date = DATE '2026-02-12';

COMMIT;
