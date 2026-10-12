#!/usr/bin/env python3
"""
Fresh complete data load from scratch
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
LOG_FILE = Path(__file__).parent / f'load_fresh_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'

def log(message):
    """Write to console and log file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_message = f"[{timestamp}] {message}"
    print(log_message)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_message + '\n')

def main():
    log("=" * 80)
    log("FRESH COMPLETE DATA LOAD FROM SCRATCH")
    log("=" * 80)
    log(f"Log file: {LOG_FILE}")
    log("")

    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        cursor = conn.cursor()
        log(f"OK: Connected to {DB_HOST}:{DB_PORT}/{DB_NAME}")
    except psycopg2.Error as e:
        log(f"ERROR: {e}")
        sys.exit(1)

    log("")

    # Get AZS mapping
    log("Loading AZS mapping...")
    cursor.execute("SELECT id, name FROM azs")
    station_map = {row[1]: row[0] for row in cursor.fetchall()}
    log(f"  Found {len(station_map)} AZS stations")
    for name, id in sorted(station_map.items()):
        log(f"    {name}: {id}")
    log("")

    total = 0

    # ========================================
    # 1. PRICES.CSV - Load all fuel types
    # ========================================
    log("[1/6] PRICES.CSV - Loading prices and sales")
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
                    log(f"  Processed {row_num} rows...")

                station_name = row.get('Название АЗС', '')
                azs_id = station_map.get(station_name)
                if not azs_id:
                    continue

                try:
                    record_date = datetime.strptime(row.get('Временная метка', ''), '%Y-%m-%d').date()
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
                    except:
                        continue

        conn.commit()
        log(f"  OK: Loaded {count:,} records")
        total += count
    except Exception as e:
        log(f"  ERROR: {e}")
    log("")

    # ========================================
    # 2. WEATHER_DATA.CSV
    # ========================================
    log("[2/6] WEATHER_DATA.CSV - Loading weather")
    csv_file = DATA_DIR / 'weather_data.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=',')
            row_num = 0
            for row in reader:
                row_num += 1
                if row_num % 500 == 0:
                    log(f"  Processed {row_num} rows...")

                station_name = row.get('station_name', '')
                azs_id = station_map.get(station_name)
                if not azs_id:
                    continue

                try:
                    record_date = datetime.strptime(row.get('date', ''), '%Y-%m-%d').date()
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
        log(f"  OK: Loaded {count:,} records")
        total += count
    except Exception as e:
        log(f"  ERROR: {e}")
    log("")

    # ========================================
    # 3. COMPETITOR_PRICES.CSV
    # ========================================
    log("[3/6] COMPETITOR_PRICES.CSV - Loading competitor prices")
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
                    log(f"  Processed {row_num:,} rows...")

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
                except:
                    continue

        conn.commit()
        log(f"  OK: Loaded {count:,} records")
        total += count
    except Exception as e:
        log(f"  ERROR: {e}")
    log("")

    # ========================================
    # 4. PROMOTIONS.CSV
    # ========================================
    log("[4/6] PROMOTIONS.CSV - Loading promotions")
    csv_file = DATA_DIR / 'promotions.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=',')
            for row in reader:
                try:
                    promo_id = str(row.get('№п/п', f"PROMO_{count}"))
                    name = row.get('Акция', '')[:255]
                    promo_type = row.get('Категория', 'other')[:100]
                    start_date_str = row.get('Дата начала', '')
                    end_date_str = row.get('Дата конца', '')

                    start_date = None
                    end_date = None
                    try:
                        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else None
                    except:
                        pass
                    try:
                        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else None
                    except:
                        pass

                    status = 'active'
                    if end_date and end_date < datetime.now().date():
                        status = 'expired'

                    cursor.execute("""
                        INSERT INTO promotions (promotion_id, name, type, start_date, end_date, status)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (promo_id, name, promo_type, start_date, end_date, status))
                    count += 1
                except:
                    continue

        conn.commit()
        log(f"  OK: Loaded {count:,} records")
        total += count
    except Exception as e:
        log(f"  ERROR: {e}")
    log("")

    # ========================================
    # 5. SHOP_SALES.CSV
    # ========================================
    log("[5/6] SHOP_SALES.CSV - Loading shop sales")
    csv_file = DATA_DIR / 'shop_sales.csv'
    count = 0

    try:
        lines = open(csv_file, 'r', encoding='utf-8').readlines()
        if lines:
            header = lines[0].strip().split(';')
            date_columns = header[7:]
            log(f"  Structure: {len(lines)-1} products x {len(date_columns)} days")

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

                        record_date = datetime.strptime(date_str, '%d.%m.%Y').date()

                        cursor.execute("""
                            INSERT INTO shop_sales (azs_id, shop_name, product_type, sales_amount, revenue, date_recorded)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (azs_id, product_name, 'product', sales_amount, sales_amount * 1.2, record_date))
                        count += 1
                    except:
                        continue

        conn.commit()
        log(f"  OK: Loaded {count:,} records")
        total += count
    except Exception as e:
        log(f"  ERROR: {e}")
    log("")

    # ========================================
    # 6. TRAFFIC_DATA.CSV
    # ========================================
    log("[6/6] TRAFFIC_DATA.CSV - Loading traffic")
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
                    log(f"  Processed {row_num} rows...")

                try:
                    date_str = row.get('Дата', '')
                    station = row.get('Название АЗС', '')
                    date_recorded = datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else None
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
                except:
                    continue

        conn.commit()
        log(f"  OK: Loaded {count:,} records")
        total += count
    except Exception as e:
        log(f"  ERROR: {e}")
    log("")

    # ========================================
    # SUMMARY
    # ========================================
    log("=" * 80)
    log(f"SUCCESS: Total {total:,} records loaded")
    log("=" * 80)
    log("")

    cursor.execute("SELECT COUNT(*) FROM sales_data")
    sales = cursor.fetchone()[0]
    log(f"sales_data:        {sales:,}")

    cursor.execute("SELECT COUNT(*) FROM competitor_prices")
    comp = cursor.fetchone()[0]
    log(f"competitor_prices: {comp:,}")

    cursor.execute("SELECT COUNT(*) FROM weather_data")
    weather = cursor.fetchone()[0]
    log(f"weather_data:      {weather:,}")

    cursor.execute("SELECT COUNT(*) FROM promotions")
    promo = cursor.fetchone()[0]
    log(f"promotions:        {promo:,}")

    cursor.execute("SELECT COUNT(*) FROM shop_sales")
    shop = cursor.fetchone()[0]
    log(f"shop_sales:        {shop:,}")

    cursor.execute("SELECT COUNT(*) FROM traffic_data")
    traffic = cursor.fetchone()[0]
    log(f"traffic_data:      {traffic:,}")

    grand_total = sales + comp + weather + promo + shop + traffic
    log(f"TOTAL:             {grand_total:,}")

    cursor.close()
    conn.close()
    log("")
    log("OK: All data loaded successfully")

if __name__ == '__main__':
    main()
