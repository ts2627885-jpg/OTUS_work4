INSERT INTO fuel_type (fuel_code, fuel_name, is_bio) VALUES
 ('AI92','АИ-92',false),('AI92_bio','АИ-92 био',true),('AI95','АИ-95',false),
 ('AI95_bio','АИ-95 био',true),('AI100','АИ-100',false),('AI100_bio','АИ-100 био',true),
 ('DT','ДТ',false),('DT_bio','ДТ био',true),('SUG','СУГ',false),('KPG','КПГ',false),('SPG','СПГ',false);

INSERT INTO station (station_code, station_name, station_ext_id, road_type, road_level, direction,
    settlement_size, distance_to_city_km, total_pumps, has_shop, shop_area_m2, has_car_wash,
    has_tire_service, has_cafe, has_hotel)
SELECT right("station_name",3), "station_name", "station_id", "road_type",
       NULLIF("road_level",'')::smallint, "direction", NULLIF("settlement_size",'')::int,
       NULLIF("distance_to_city_km",'')::int, NULLIF("total_pumps",'')::smallint,
       ("has_shop")::int::boolean, NULLIF("shop_area_m2",'')::numeric,
       ("has_car_wash")::int::boolean, ("has_tire_service")::int::boolean,
       ("has_cafe")::int::boolean, ("has_hotel")::int::boolean
FROM stg.stations;

INSERT INTO calendar (cal_date, day_of_week, week_of_year, month, quarter, year, season,
    is_weekend, is_holiday, holiday_name)
SELECT DISTINCT ON ("Временная метка")
       "Временная метка"::date, day_of_week::smallint, week_of_year::smallint, month::smallint,
       quarter::smallint, year::smallint, season,
       is_weekend IN ('1','True','true'), is_holiday IN ('1','True','true'), NULLIF(holiday_name,'')
FROM stg.prices
ORDER BY "Временная метка";

INSERT INTO competitor (station_code, brand, brand_no)
SELECT DISTINCT right(station_id,3), brand, "number" FROM stg.cp;

INSERT INTO competitor_price (source_row_no, competitor_id, fuel_code, is_brand_price, observed_at, price, is_offered)
SELECT c.source_row_no::int, k.competitor_id, c.fuel_code, c.is_brand_price::boolean,
       c.observed_at::timestamp, NULLIF(c.price,'')::numeric, c.is_offered::boolean
FROM stg.cp c
JOIN competitor k ON k.station_code = right(c.station_id,3) AND k.brand = c.brand AND k.brand_no = c."number";

INSERT INTO fuel_daily (station_code, sale_date, fuel_code, sales_volume, price, is_offered)
SELECT station_code, sale_date::date, fuel_code, sales_volume::numeric,
       NULLIF(price,'')::numeric, is_offered::boolean
FROM stg.fuel;

INSERT INTO station_daily (station_code, cal_date, total_fuel_sales, corporate_customer_ratio, customer_loyalty_score)
SELECT right("Название АЗС",3), "Временная метка"::date, NULLIF(total_fuel_sales,'')::numeric,
       NULLIF(corporate_customer_ratio,'')::numeric, NULLIF(customer_loyalty_score,'')::numeric
FROM stg.prices;

INSERT INTO traffic_daily (station_code, traffic_date, cars, transporters, trucks, trucks_long, trucks_short,
    undefined, intensity_physical, intensity_private, density, speed, service_level)
SELECT station_code, traffic_date::date,
       NULLIF("traffic_Passengers_cars",'')::numeric, NULLIF("traffic_Transporter",'')::numeric,
       NULLIF("traffic_Truck",'')::numeric, NULLIF("traffic_Truck_long",'')::numeric,
       NULLIF("traffic_Truck_short",'')::numeric, NULLIF("traffic_Undefined",'')::numeric,
       NULLIF("traffic_intensiv_fiz",'')::numeric, NULLIF("traffic_intensiv_priv",'')::numeric,
       NULLIF("traffic_plotnost",'')::numeric, NULLIF("traffic_scorost",'')::numeric,
       NULLIF("traffic_uroven_jbslugi",'')
FROM stg.traffic;

INSERT INTO weather_daily (station_code, weather_date, temperature_c, humidity_pct, pressure_hpa,
    wind_speed_ms, precipitation_mm, weather_type)
SELECT station_code, "date"::date, "temperature_C"::numeric, "humidity_%"::numeric::smallint,
       "pressure_hPa"::numeric, "wind_speed_ms"::numeric, "precipitation_mm"::numeric, weather_type
FROM stg.weather;

INSERT INTO shop_product (product_code, group_name)
SELECT DISTINCT "Переменная", 'Продажи сопутствующих товаров' FROM stg.shop;

INSERT INTO shop_sales_daily (station_code, product_code, sale_date, revenue_rub)
SELECT station_code, "Переменная", sale_date::date, revenue_rub::numeric FROM stg.shop;

INSERT INTO promotion (source_no, company, name, start_date, end_date, duration_days, category, coverage, description, validity)
SELECT source_no::int, NULLIF(company,''), name, NULLIF(start_date,'')::date, NULLIF(end_date,'')::date,
       NULLIF(duration_days,'')::numeric::smallint, category, coverage, NULLIF(description,''), NULLIF(validity,'')
FROM stg.promo;

SELECT 'station' t, count(*) FROM station UNION ALL
SELECT 'calendar', count(*) FROM calendar UNION ALL
SELECT 'fuel_type', count(*) FROM fuel_type UNION ALL
SELECT 'competitor', count(*) FROM competitor UNION ALL
SELECT 'competitor_price', count(*) FROM competitor_price UNION ALL
SELECT 'fuel_daily', count(*) FROM fuel_daily UNION ALL
SELECT 'station_daily', count(*) FROM station_daily UNION ALL
SELECT 'traffic_daily', count(*) FROM traffic_daily UNION ALL
SELECT 'weather_daily', count(*) FROM weather_daily UNION ALL
SELECT 'shop_product', count(*) FROM shop_product UNION ALL
SELECT 'shop_sales_daily', count(*) FROM shop_sales_daily UNION ALL
SELECT 'promotion', count(*) FROM promotion;
