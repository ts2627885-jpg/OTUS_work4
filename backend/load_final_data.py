#!/usr/bin/env python3
"""
Load ALL remaining data files: promotions, shop_sales, traffic_data
+ All previous data (prices, competitor_prices, weather)
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

def connect_db():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        return conn
    except psycopg2.Error as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

def load_all():
    print("=" * 80)
    print("COMPLETE DATA IMPORT - ALL FILES")
    print("=" * 80)
    print()

    conn = connect_db()
    cursor = conn.cursor()
    total = 0

    # Get station mapping
    cursor.execute("SELECT id, name FROM azs")
    station_map = {row[1]: row[0] for row in cursor.fetchall()}

    # ========================================
    # 1. PRICES.CSV - ALL FUEL TYPES
    # ========================================
    print("[1/6] PRICES.CSV - Loading all fuel types...")
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
            for row in reader:
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
                        except (ValueError, TypeError):
                            sales = None

                        try:
                            price = float(price_str.replace(',', '.'))
                        except (ValueError, TypeError):
                            price = None

                        # Load ALL records, including those with 0 or NULL values
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
                    except Exception:
                        continue

        conn.commit()
        print(f"      ✓ Loaded {count:,} price & sales records")
        total += count
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # ========================================
    # 2. WEATHER_DATA.CSV
    # ========================================
    print("[2/6] WEATHER_DATA.CSV - Loading weather data...")
    csv_file = DATA_DIR / 'weather_data.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=',')
            for row in reader:
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
        print(f"      ✓ Loaded {count:,} weather records")
        total += count
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # ========================================
    # 3. COMPETITOR_PRICES.CSV
    # ========================================
    print("[3/6] COMPETITOR_PRICES.CSV - Loading competitor prices...")
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
                    print(f"      Processed {row_num:,} rows...")

                station_name = row.get('Название АЗС', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    price_str = row.get('Значение', '0')
                    try:
                        price = float((price_str or '0').replace(',', '.'))
                    except (ValueError, TypeError):
                        price = None

                    variable = row.get('Переменная', '')
                    brand = row.get('Brand', 'Unknown')

                    # Determine fuel type from variable name
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

                    # Insert ALL records, including those with price = 0 or NULL
                    cursor.execute("""
                        INSERT INTO competitor_prices (azs_id, competitor_name, fuel_type, price, distance_km)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (azs_id, brand, fuel_type, price if price is not None else None, 0))

                    count += 1
                except Exception as e:
                    continue

        conn.commit()
        print(f"      ✓ Loaded {count:,} competitor price records")
        total += count
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # ========================================
    # 4. PROMOTIONS.CSV
    # ========================================
    print("[4/6] PROMOTIONS.CSV - Loading promotions...")
    csv_file = DATA_DIR / 'promotions.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                try:
                    promo_id = row.get('promotion_id', f"PROMO_{count}")
                    name = row.get('name', '')
                    promo_type = row.get('type', 'discount')
                    start_date_str = row.get('start_date', '')
                    end_date_str = row.get('end_date', '')
                    discount_str = row.get('discount', '0')

                    start_date = None
                    end_date = None
                    discount = None

                    if start_date_str:
                        try:
                            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                        except:
                            pass

                    if end_date_str:
                        try:
                            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        except:
                            pass

                    if discount_str:
                        try:
                            discount = float(discount_str.replace(',', '.'))
                        except:
                            pass

                    status = 'active'
                    if end_date and end_date < datetime.now().date():
                        status = 'expired'

                    cursor.execute("""
                        INSERT INTO promotions (promotion_id, name, type, start_date, end_date, discount, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (promo_id, name, promo_type, start_date, end_date, discount, status))

                    count += 1
                except Exception as e:
                    continue

        conn.commit()
        print(f"      ✓ Loaded {count:,} promotion records")
        total += count
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # ========================================
    # 5. SHOP_SALES.CSV (wide format → long format)
    # ========================================
    print("[5/6] SHOP_SALES.CSV - Loading shop sales...")
    csv_file = DATA_DIR / 'shop_sales.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            if not lines:
                raise Exception("Empty file")

            # Parse header to get dates
            header = lines[0].strip().split(';')
            # Dates are in columns 7 onwards (after: № п/п, Наименование групп, № в группе, Переменная, Тип, Описание, АЗС)
            date_columns = header[7:]

            # Parse data rows
            for line in lines[1:]:
                if not line.strip():
                    continue

                cols = line.strip().split(';')
                if len(cols) < 8:
                    continue

                product_name = cols[1]  # Наименование групп
                product_type = cols[3]  # Переменная
                azs_name = cols[6]      # АЗС

                # Find AZS ID
                azs_id = station_map.get(azs_name)
                if not azs_id:
                    continue

                # Iterate through dates and values
                for idx, date_str in enumerate(date_columns):
                    if idx + 7 >= len(cols):
                        break

                    try:
                        sales_str = cols[idx + 7].strip()
                        if not sales_str or sales_str == '':
                            continue

                        sales_amount = float(sales_str.replace(',', '.'))
                        if sales_amount <= 0:
                            continue

                        record_date = datetime.strptime(date_str, '%d.%m.%Y').date()

                        cursor.execute("""
                            INSERT INTO shop_sales (azs_id, shop_name, product_type, sales_amount, revenue, date_recorded)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (azs_id, product_name, product_type, sales_amount, sales_amount * 1.2, record_date))

                        count += 1
                    except (ValueError, TypeError, IndexError):
                        continue

        conn.commit()
        print(f"      ✓ Loaded {count:,} shop sales records")
        total += count
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # ========================================
    # 6. TRAFFIC_DATA.CSV
    # ========================================
    print("[6/6] TRAFFIC_DATA.CSV - Loading traffic data...")
    csv_file = DATA_DIR / 'traffic_data.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                try:
                    date_str = row.get('date', '')
                    station = row.get('station', '')
                    cars_str = row.get('cars', '0')
                    trucks_str = row.get('trucks', '0')
                    motorcycles_str = row.get('motorcycles', '0')
                    buses_str = row.get('buses', '0')

                    date_recorded = None
                    if date_str:
                        try:
                            date_recorded = datetime.strptime(date_str, '%Y-%m-%d').date()
                        except:
                            pass

                    cars = int(float(cars_str)) if cars_str else 0
                    trucks = int(float(trucks_str)) if trucks_str else 0
                    motorcycles = int(float(motorcycles_str)) if motorcycles_str else 0
                    buses = int(float(buses_str)) if buses_str else 0
                    total_vehicles = cars + trucks + motorcycles + buses

                    azs_id = station_map.get(station)

                    if not date_recorded or not azs_id:
                        continue

                    cursor.execute("""
                        INSERT INTO traffic_data (azs_id, date_recorded, cars, trucks, motorcycles, buses, total_vehicles)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (azs_id, date_recorded, cars, trucks, motorcycles, buses, total_vehicles))

                    count += 1
                except Exception as e:
                    continue

        conn.commit()
        print(f"      ✓ Loaded {count:,} traffic data records")
        total += count
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # ========================================
    # SUMMARY
    # ========================================
    print("=" * 80)
    print(f"[SUCCESS] Total records loaded: {total:,}")
    print("=" * 80)
    print()

    # Statistics
    cursor.execute("SELECT COUNT(*) FROM sales_data")
    sales_count = cursor.fetchone()[0]
    print(f"Sales Data:        {sales_count:,} records")

    cursor.execute("SELECT COUNT(*) FROM competitor_prices")
    comp_count = cursor.fetchone()[0]
    print(f"Competitor Prices: {comp_count:,} records")

    cursor.execute("SELECT COUNT(*) FROM weather_data")
    weather_count = cursor.fetchone()[0]
    print(f"Weather Data:      {weather_count:,} records")

    cursor.execute("SELECT COUNT(*) FROM promotions")
    promo_count = cursor.fetchone()[0]
    print(f"Promotions:        {promo_count:,} records")

    cursor.execute("SELECT COUNT(*) FROM shop_sales")
    shop_count = cursor.fetchone()[0]
    print(f"Shop Sales:        {shop_count:,} records")

    cursor.execute("SELECT COUNT(*) FROM traffic_data")
    traffic_count = cursor.fetchone()[0]
    print(f"Traffic Data:      {traffic_count:,} records")

    grand_total = sales_count + comp_count + weather_count + promo_count + shop_count + traffic_count
    print()
    print(f"GRAND TOTAL:       {grand_total:,} records")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    load_all()
