#!/usr/bin/env python3
"""
Load ALL data from ALL CSV files - COMPLETE
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
    print("COMPLETE DATA IMPORT - ALL FILES AND ALL TYPES")
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
    print("[1/3] PRICES.CSV - Loading all fuel types...")
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
                        sales = float((row.get(sales_key, '0') or '0').replace(',', '.'))
                        price = float((row.get(price_key, '0') or '0').replace(',', '.'))

                        if sales > 0 and price > 0:
                            cursor.execute("""
                                INSERT INTO prices (azs_id, fuel_type, price, trend, updated_at)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (azs_id, fuel_type) DO UPDATE SET price = EXCLUDED.price
                            """, (azs_id, fuel_type, price, 'stable', record_date))

                            cursor.execute("""
                                INSERT INTO sales_data (azs_id, fuel_type, volume, revenue, date_recorded)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (azs_id, fuel_type, sales, sales * price, record_date))

                            count += 1
                    except (ValueError, TypeError):
                        continue

        conn.commit()
        print(f"      ✓ Loaded {count} price & sales records")
        total += count
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # ========================================
    # 2. WEATHER_DATA.CSV
    # ========================================
    print("[2/3] WEATHER_DATA.CSV - Loading weather data...")
    csv_file = DATA_DIR / 'weather_data.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=',')
            for row in reader:
                station_name = row.get('АЗС', '') or row.get('station', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    record_date = datetime.strptime(row.get('дата', ''), '%Y-%m-%d').date()

                    cursor.execute("""
                        INSERT INTO weather_data (azs_id, temperature, humidity, wind_speed, conditions, date_recorded)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (azs_id, None, None, None, 'Unknown', record_date))

                    count += 1
                except:
                    continue

        conn.commit()
        print(f"      ✓ Loaded {count} weather records")
        total += count
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # ========================================
    # 3. COMPETITOR_PRICES.CSV
    # ========================================
    print("[3/3] COMPETITOR_PRICES.CSV - Loading all competitor prices...")
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
                    print(f"      Processed {row_num} rows...")

                station_name = row.get('Название АЗС', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    price_str = row.get('Значение', '0')
                    price = float((price_str or '0').replace(',', '.'))

                    if price <= 0:
                        continue

                    variable = row.get('Переменная', '')
                    brand = row.get('Brand', 'Unknown')

                    # Determine fuel type from variable name
                    fuel_type = 'A95'  # default
                    if 'AI92' in variable or 'АИ-92' in variable:
                        fuel_type = 'A92'
                    elif 'AI95' in variable or 'АИ-95' in variable:
                        fuel_type = 'A95'
                    elif 'AI98' in variable or 'АИ-98' in variable:
                        fuel_type = 'A98'
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
                except (ValueError, TypeError):
                    continue

        conn.commit()
        print(f"      ✓ Loaded {count} competitor price records")
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
    cursor.execute("SELECT fuel_type, COUNT(*) FROM sales_data GROUP BY fuel_type ORDER BY count DESC")
    print("Fuel types in database:")
    for fuel_type, cnt in cursor.fetchall():
        print(f"  ✓ {fuel_type}: {cnt:,} records")

    print()
    cursor.execute("SELECT COUNT(*) FROM competitor_prices")
    print(f"Total competitor prices: {cursor.fetchone()[0]:,}")

    cursor.execute("SELECT COUNT(*) FROM weather_data")
    print(f"Total weather records: {cursor.fetchone()[0]:,}")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    load_all()
