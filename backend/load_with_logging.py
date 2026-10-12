#!/usr/bin/env python3
"""
Load ALL data with detailed logging
"""

import os
import sys
import csv
import psycopg2
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'azs_pult')

DATA_DIR = Path(__file__).parent.parent / '_data'
LOG_FILE = Path(__file__).parent / f'load_log_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'

def log(message):
    """Write to console and log file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_message = f"[{timestamp}] {message}"
    print(log_message)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_message + '\n')

def connect_db():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        log(f"✅ Подключение к БД успешно: {DB_HOST}:{DB_PORT}/{DB_NAME}")
        return conn
    except psycopg2.Error as e:
        log(f"❌ ОШИБКА подключения к БД: {e}")
        sys.exit(1)

def load_all():
    log("=" * 80)
    log("ПОЛНАЯ ЗАГРУЗКА ВСЕХ ДАННЫХ С ЛОГИРОВАНИЕМ")
    log("=" * 80)
    log(f"Логирование в: {LOG_FILE}")
    log("")

    conn = connect_db()
    cursor = conn.cursor()
    total = 0

    # Get station mapping
    log("Загрузка маппинга АЗС...")
    cursor.execute("SELECT id, name FROM azs")
    station_map = {row[1]: row[0] for row in cursor.fetchall()}
    log(f"  Найдено АЗС: {len(station_map)}")
    for name, id in station_map.items():
        log(f"    - {name}: {id}")
    log("")

    # ========================================
    # 1. PRICES.CSV
    # ========================================
    log("[1/6] PRICES.CSV - Загрузка цен и продаж")
    csv_file = DATA_DIR / 'prices.csv'
    count = 0

    fuel_types = {
        'A92': ('sales_AI92', 'price_AI92'),
        'A92_bio': ('sales_AI92_bio', 'price_AI92_bio'),
        'A95': ('sales_AI95', 'price_AI95'),
        'A95_bio': ('sales_AI95_bio', 'price_AI95_bio'),
        'A100_bio': ('sales_AI100_bio', 'price_AI100_bio'),
        'DT': ('sales_DT', 'price_DT'),
        'DT_bio': ('sales_DT_bio', 'price_DT_bio'),
        'SUG': ('sales_SUG', 'price_SUG'),
        'KPG': ('sales_KPG', 'price_KPG'),
        'SPG': ('sales_SPG', 'price_SPG'),
    }

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=';')
            row_num = 0
            for row in reader:
                row_num += 1
                if row_num % 500 == 0:
                    conn.commit()
                    log(f"  Обработано {row_num} строк...")

                station_name = row.get('Название АЗС', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    from datetime import datetime as dt
                    record_date = dt.strptime(row.get('Временная метка', ''), '%Y-%m-%d').date()
                except:
                    continue

                for fuel_type, (sales_key, price_key) in fuel_types.items():
                    try:
                        sales_str = row.get(sales_key, '0') or '0'
                        price_str = row.get(price_key, '0') or '0'

                        try:
                            sales = float(sales_str.replace(',', '.'))
                        except:
                            sales = None

                        try:
                            price = float(price_str.replace(',', '.'))
                        except:
                            price = None

                        if price is not None:
                            cursor.execute("""
                                INSERT INTO prices (azs_id, fuel_type, price, trend, updated_at)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (azs_id, fuel_type) DO UPDATE SET price = EXCLUDED.price
                            """, (azs_id, fuel_type, price if price > 0 else None, 'stable', record_date))

                        if sales is not None:
                            revenue = (sales * price) if price and price > 0 else None
                            cursor.execute("""
                                INSERT INTO sales_data (azs_id, fuel_type, volume, revenue, date_recorded)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (azs_id, fuel_type, sales if sales > 0 else None, revenue, record_date))

                            count += 1
                    except Exception as e:
                        continue

        conn.commit()
        log(f"  ✅ Загружено {count:,} записей")
        total += count
    except Exception as e:
        log(f"  ❌ ОШИБКА: {e}")
    log("")

    # ========================================
    # 2. WEATHER_DATA.CSV
    # ========================================
    log("[2/6] WEATHER_DATA.CSV - Загрузка погоды")
    csv_file = DATA_DIR / 'weather_data.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=',')
            row_num = 0
            for row in reader:
                row_num += 1
                if row_num % 500 == 0:
                    log(f"  Обработано {row_num} строк...")

                station_name = row.get('station_name', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    from datetime import datetime as dt
                    record_date = dt.strptime(row.get('date', ''), '%Y-%m-%d').date()

                    temp_str = row.get('temperature_C', '').strip()
                    humidity_str = row.get('humidity_%', '').strip()
                    wind_str = row.get('wind_speed_ms', '').strip()
                    conditions = row.get('weather_type', 'Unknown')

                    temp = float(temp_str) if temp_str else None
                    humidity = float(humidity_str) if humidity_str else None
                    wind = float(wind_str) if wind_str else None

                    cursor.execute("""
                        INSERT INTO weather_data (azs_id, temperature, humidity, wind_speed, conditions, date_recorded)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (azs_id, temp, humidity, wind, conditions, record_date))

                    count += 1
                except:
                    continue

        conn.commit()
        log(f"  ✅ Загружено {count:,} записей")
        total += count
    except Exception as e:
        log(f"  ❌ ОШИБКА: {e}")
    log("")

    # ========================================
    # 3. COMPETITOR_PRICES.CSV
    # ========================================
    log("[3/6] COMPETITOR_PRICES.CSV - Загрузка цен конкурентов")
    csv_file = DATA_DIR / 'competitor_prices.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=';')
            row_num = 0

            for row in reader:
                row_num += 1
                if row_num % 10000 == 0:
                    conn.commit()
                    log(f"  Обработано {row_num:,} строк...")

                station_name = row.get('Название АЗС', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    price_str = row.get('Значение', '0')
                    try:
                        price = float((price_str or '0').replace(',', '.'))
                    except:
                        price = None

                    variable = row.get('Переменная', '')
                    brand = row.get('Brand', 'Unknown')

                    fuel_type = 'A95'
                    if 'AI92' in variable or 'АИ-92' in variable:
                        fuel_type = 'A92'
                    elif 'AI95' in variable or 'АИ-95' in variable:
                        fuel_type = 'A95'
                    elif 'AI100' in variable or 'АИ-100' in variable:
                        fuel_type = 'A100'
                    elif 'DT' in variable or 'ДТ' in variable:
                        fuel_type = 'DT'
                    elif 'KPG' in variable:
                        fuel_type = 'KPG'
                    elif 'SUG' in variable:
                        fuel_type = 'SUG'
                    elif 'SPG' in variable:
                        fuel_type = 'SPG'

                    cursor.execute("""
                        INSERT INTO competitor_prices (azs_id, competitor_name, fuel_type, price, distance_km)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (azs_id, brand, fuel_type, price, 0))

                    count += 1
                except Exception as e:
                    continue

        conn.commit()
        log(f"  ✅ Загружено {count:,} записей")
        total += count
    except Exception as e:
        log(f"  ❌ ОШИБКА: {e}")
    log("")

    # ========================================
    # 4. PROMOTIONS.CSV
    # ========================================
    log("[4/6] PROMOTIONS.CSV - Загрузка акций")
    csv_file = DATA_DIR / 'promotions.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=',')
            row_num = 0
            for row in reader:
                row_num += 1
                if row_num % 20 == 0:
                    conn.commit()

                try:
                    promotion_id = row.get('№п/п', f"PROMO_{count}")
                    name = row.get('Акция', '')
                    promo_type = row.get('Категория', 'other')
                    start_date_str = row.get('Дата начала', '')
                    end_date_str = row.get('Дата конца', '')

                    from datetime import datetime as dt
                    start_date = dt.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else None
                    end_date = dt.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else None

                    status = 'active'
                    if end_date and end_date < dt.now().date():
                        status = 'expired'

                    cursor.execute("""
                        INSERT INTO promotions (promotion_id, name, type, start_date, end_date, status)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (str(promotion_id), name[:255], promo_type[:100], start_date, end_date, status))

                    count += 1
                except Exception as e:
                    continue

        conn.commit()
        log(f"  ✅ Загружено {count:,} записей")
        total += count
    except Exception as e:
        log(f"  ❌ ОШИБКА: {e}")
    log("")

    # ========================================
    # 5. SHOP_SALES.CSV
    # ========================================
    log("[5/6] SHOP_SALES.CSV - Загрузка продаж в магазине")
    csv_file = DATA_DIR / 'shop_sales.csv'
    count = 0

    try:
        lines = open(csv_file, 'r', encoding='utf-8').readlines()
        if lines:
            header = lines[0].strip().split(';')
            date_columns = header[7:]

            log(f"  Структура: {len(lines)-1} товаров × {len(date_columns)} дней")

            from datetime import datetime as dt
            for line_num, line in enumerate(lines[1:], 1):
                if line_num % 10 == 0:
                    conn.commit()

                cols = line.strip().split(';')
                if len(cols) < 8:
                    continue

                product_name = cols[1]
                azs_name = cols[6]
                azs_id = station_map.get(azs_name)

                if not azs_id:
                    continue

                for date_idx, date_str in enumerate(date_columns):
                    col_idx = 7 + date_idx
                    if col_idx >= len(cols):
                        break

                    try:
                        sales_str = cols[col_idx].strip()
                        if not sales_str:
                            continue

                        sales_amount = float(sales_str.replace(',', '.'))
                        if sales_amount <= 0:
                            continue

                        record_date = dt.strptime(date_str, '%d.%m.%Y').date()

                        cursor.execute("""
                            INSERT INTO shop_sales (azs_id, shop_name, product_type, sales_amount, revenue, date_recorded)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (azs_id, product_name, 'product', sales_amount, sales_amount * 1.2, record_date))

                        count += 1
                    except:
                        continue

        conn.commit()
        log(f"  ✅ Загружено {count:,} записей")
        total += count
    except Exception as e:
        log(f"  ❌ ОШИБКА: {e}")
    log("")

    # ========================================
    # 6. TRAFFIC_DATA.CSV
    # ========================================
    log("[6/6] TRAFFIC_DATA.CSV - Загрузка данных трафика")
    csv_file = DATA_DIR / 'traffic_data.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=',')
            row_num = 0
            for row in reader:
                row_num += 1
                if row_num % 200 == 0:
                    conn.commit()
                    log(f"  Обработано {row_num} строк...")

                try:
                    from datetime import datetime as dt
                    date_str = row.get('Дата', '')
                    station = row.get('Название АЗС', '')

                    date_recorded = dt.strptime(date_str, '%Y-%m-%d').date() if date_str else None
                    azs_id = station_map.get(station)

                    if not date_recorded or not azs_id:
                        continue

                    cars = int(float(row.get('traffic_Passengers_cars', '0') or '0'))
                    trucks = int(float(row.get('traffic_Truck', '0') or '0'))
                    motorcycles = int(float(row.get('traffic_Transporter', '0') or '0'))
                    total_vehicles = cars + trucks + motorcycles

                    cursor.execute("""
                        INSERT INTO traffic_data (azs_id, date_recorded, cars, trucks, motorcycles, buses, total_vehicles)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (azs_id, date_recorded, cars, trucks, motorcycles, 0, total_vehicles))

                    count += 1
                except Exception as e:
                    continue

        conn.commit()
        log(f"  ✅ Загружено {count:,} записей")
        total += count
    except Exception as e:
        log(f"  ❌ ОШИБКА: {e}")
    log("")

    # ========================================
    # SUMMARY
    # ========================================
    log("=" * 80)
    log(f"✅ ИТОГО ЗАГРУЖЕНО: {total:,} записей")
    log("=" * 80)
    log("")

    cursor.execute("SELECT COUNT(*) FROM sales_data")
    log(f"sales_data:        {cursor.fetchone()[0]:,} записей")

    cursor.execute("SELECT COUNT(*) FROM competitor_prices")
    log(f"competitor_prices: {cursor.fetchone()[0]:,} записей")

    cursor.execute("SELECT COUNT(*) FROM weather_data")
    log(f"weather_data:      {cursor.fetchone()[0]:,} записей")

    cursor.execute("SELECT COUNT(*) FROM promotions")
    log(f"promotions:        {cursor.fetchone()[0]:,} записей")

    cursor.execute("SELECT COUNT(*) FROM shop_sales")
    log(f"shop_sales:        {cursor.fetchone()[0]:,} записей")

    cursor.execute("SELECT COUNT(*) FROM traffic_data")
    log(f"traffic_data:      {cursor.fetchone()[0]:,} записей")

    cursor.close()
    conn.close()

    log("")
    log("✅ ВСЕ ДАННЫЕ ЗАГРУЖЕНЫ")

if __name__ == '__main__':
    load_all()
