DROP SCHEMA IF EXISTS azs CASCADE;
CREATE SCHEMA azs;
SET search_path TO azs;

CREATE TABLE station (
    station_code        CHAR(3) PRIMARY KEY,
    station_name        VARCHAR(20)  NOT NULL UNIQUE,
    station_ext_id      VARCHAR(30),
    road_type           VARCHAR(100),
    road_level          SMALLINT,
    direction           VARCHAR(100),
    settlement_size     INTEGER,
    distance_to_city_km INTEGER,
    total_pumps         SMALLINT,
    has_shop            BOOLEAN,
    shop_area_m2        NUMERIC(10,2),
    has_car_wash        BOOLEAN,
    has_tire_service    BOOLEAN,
    has_cafe            BOOLEAN,
    has_hotel           BOOLEAN
);

CREATE TABLE calendar (
    cal_date        DATE PRIMARY KEY,
    day_of_week     SMALLINT NOT NULL,
    week_of_year    SMALLINT NOT NULL,
    month           SMALLINT NOT NULL,
    quarter         SMALLINT NOT NULL,
    year            SMALLINT NOT NULL,
    season          VARCHAR(10) NOT NULL,
    is_weekend      BOOLEAN NOT NULL,
    is_holiday      BOOLEAN NOT NULL,
    holiday_name    VARCHAR(100)
);

CREATE TABLE fuel_type (
    fuel_code   VARCHAR(20) PRIMARY KEY,
    fuel_name   VARCHAR(100) NOT NULL,
    is_bio      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE competitor (
    competitor_id   SERIAL PRIMARY KEY,
    station_code    CHAR(3) NOT NULL REFERENCES station(station_code),
    brand           VARCHAR(100) NOT NULL,
    brand_no        VARCHAR(50)  NOT NULL,
    UNIQUE (station_code, brand, brand_no)
);

CREATE TABLE competitor_price (
    source_row_no   INTEGER PRIMARY KEY,
    competitor_id   INTEGER NOT NULL REFERENCES competitor(competitor_id),
    fuel_code       VARCHAR(20) NOT NULL REFERENCES fuel_type(fuel_code),
    is_brand_price  BOOLEAN NOT NULL DEFAULT FALSE,
    observed_at     TIMESTAMP NOT NULL,
    price           NUMERIC(10,2),
    is_offered      BOOLEAN NOT NULL,
    CHECK ((is_offered AND price > 0) OR (NOT is_offered AND price IS NULL))
);
CREATE INDEX ix_competitor_price_time ON competitor_price (competitor_id, fuel_code, observed_at);

CREATE TABLE fuel_daily (
    station_code    CHAR(3) NOT NULL REFERENCES station(station_code),
    sale_date       DATE NOT NULL REFERENCES calendar(cal_date),
    fuel_code       VARCHAR(20) NOT NULL REFERENCES fuel_type(fuel_code),
    sales_volume    NUMERIC(12,2) NOT NULL,
    price           NUMERIC(10,2),
    is_offered      BOOLEAN NOT NULL,
    price_filled    BOOLEAN NOT NULL DEFAULT FALSE,
    price_fill_method VARCHAR(10),
    PRIMARY KEY (station_code, sale_date, fuel_code),
    CHECK ((is_offered AND price > 0) OR (NOT is_offered AND price IS NULL))
);

CREATE TABLE station_daily (
    station_code            CHAR(3) NOT NULL REFERENCES station(station_code),
    cal_date                DATE NOT NULL REFERENCES calendar(cal_date),
    total_fuel_sales        NUMERIC(12,2),
    corporate_customer_ratio NUMERIC(8,4),
    customer_loyalty_score  NUMERIC(8,2),
    PRIMARY KEY (station_code, cal_date)
);

CREATE TABLE traffic_daily (
    station_code        CHAR(3) NOT NULL REFERENCES station(station_code),
    traffic_date        DATE NOT NULL REFERENCES calendar(cal_date),
    cars                NUMERIC(12,4),
    transporters        NUMERIC(12,4),
    trucks              NUMERIC(12,4),
    trucks_long         NUMERIC(12,4),
    trucks_short        NUMERIC(12,4),
    undefined           NUMERIC(12,4),
    intensity_physical  NUMERIC(12,4),
    intensity_private   NUMERIC(12,4),
    density             NUMERIC(12,4),
    speed               NUMERIC(12,4),
    service_level       VARCHAR(5),
    PRIMARY KEY (station_code, traffic_date)
);

CREATE TABLE weather_daily (
    station_code        CHAR(3) NOT NULL REFERENCES station(station_code),
    weather_date        DATE NOT NULL REFERENCES calendar(cal_date),
    temperature_c       NUMERIC(5,2),
    humidity_pct        SMALLINT,
    pressure_hpa        NUMERIC(7,2),
    wind_speed_ms       NUMERIC(5,2),
    precipitation_mm    NUMERIC(6,2),
    weather_type        VARCHAR(50),
    PRIMARY KEY (station_code, weather_date)
);

CREATE TABLE shop_product (
    product_code    VARCHAR(60) PRIMARY KEY,
    group_name      VARCHAR(200) NOT NULL
);

CREATE TABLE shop_sales_daily (
    station_code    CHAR(3) NOT NULL REFERENCES station(station_code),
    product_code    VARCHAR(60) NOT NULL REFERENCES shop_product(product_code),
    sale_date       DATE NOT NULL REFERENCES calendar(cal_date),
    revenue_rub     NUMERIC(14,4) NOT NULL,
    PRIMARY KEY (station_code, product_code, sale_date)
);

CREATE TABLE promotion (
    promotion_id    SERIAL PRIMARY KEY,
    source_no       INTEGER NOT NULL UNIQUE,
    company         VARCHAR(100),             -- ВИНК из promotions.csv (пусто у части строк)
    name            VARCHAR(300) NOT NULL,
    start_date      DATE,                     -- пусто, если в CSV нет даты
    end_date        DATE,                     -- пусто = бессрочная акция
    duration_days   SMALLINT,
    category        VARCHAR(100) NOT NULL,
    coverage        VARCHAR(50) NOT NULL,
    description     TEXT,
    validity        VARCHAR(20),              -- бессрочно / по дате / неизвестно (из CSV)
    CHECK (end_date >= start_date)
);
