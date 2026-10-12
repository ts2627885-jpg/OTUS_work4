#!/usr/bin/env python3
"""
Import ALL CSV data into PostgreSQL for AZS-Pult system.
Loads all CSV files from _data folder.
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
        print(f"[OK] Connected to {DB_NAME}@{DB_HOST}:{DB_PORT}")
        return conn
    except psycopg2.Error as e:
        print(f"[ERROR] Failed to connect: {e}")
        sys.exit(1)

def load_stations(conn):
    print("\n[1/6] Loading STATIONS from stations.csv...")

    csv_file = DATA_DIR / 'stations.csv'
    if not csv_file.exists():
        print(f"    File not found: {csv_file}")
        return 0

    cursor = conn.cursor()
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                station_name = row.get('station_name') or row.get('АЗС', 'Unknown')

                cursor.execute("SELECT id FROM azs WHERE name = %s", (station_name,))
                if cursor.fetchone():
                    continue

                cursor.execute("""
                    INSERT INTO azs (name, address, region, fuel_types, manager, status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    station_name,
                    row.get('road_type', 'Unknown'),
                    'Tver region',
                    [],
                    None,
                    'active'
                ))
                count += 1

        conn.commit()
        print(f"    [OK] Loaded {count} stations")
    except Exception as e:
        conn.rollback()
        print(f"    [ERROR] {e}")
    finally:
        cursor.close()

    return count

def load_prices_and_sales(conn):
    print("\n[2/6] Loading PRICES AND SALES from prices.csv...")

    csv_file = DATA_DIR / 'prices.csv'
    if not csv_file.exists():
        print(f"    File not found: {csv_file}")
        return 0

    cursor = conn.cursor()
    count = 0

    try:
        cursor.execute("SELECT id, name FROM azs")
        station_map = {row[1]: row[0] for row in cursor.fetchall()}

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')
            row_count = 0

            for row in reader:
                row_count += 1
                station_name = row.get('Название АЗС', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    date_str = row.get('Временная метка', '')
                    record_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                except:
                    continue

                fuel_types = {
                    'A92': ('sales_AI92', 'price_AI92'),
                    'A95': ('sales_AI95', 'price_AI95'),
                    'DT': ('sales_DT', 'price_DT'),
                }

                for fuel_type, (sales_key, price_key) in fuel_types.items():
                    try:
                        sales_val = row.get(sales_key, '0')
                        price_val = row.get(price_key, '0')

                        sales = float((sales_val or '0').replace(',', '.'))
                        price = float((price_val or '0').replace(',', '.'))

                        if sales > 0 and price > 0:
                            cursor.execute("""
                                INSERT INTO prices (azs_id, fuel_type, price, trend, updated_at)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (azs_id, fuel_type)
                                DO UPDATE SET price = EXCLUDED.price
                            """, (azs_id, fuel_type, price, 'stable', record_date))

                            revenue = sales * price
                            cursor.execute("""
                                INSERT INTO sales_data (azs_id, fuel_type, volume, revenue, date_recorded)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (azs_id, fuel_type, sales, revenue, record_date))

                            count += 1
                    except (ValueError, TypeError):
                        continue

                if row_count % 500 == 0:
                    conn.commit()

        conn.commit()
        print(f"    [OK] Loaded {count} price and sales records")
    except Exception as e:
        conn.rollback()
        print(f"    [ERROR] {e}")
    finally:
        cursor.close()

    return count

def load_competitor_prices(conn):
    print("\n[3/6] Loading COMPETITOR PRICES from competitor_prices.csv...")

    csv_file = DATA_DIR / 'competitor_prices.csv'
    if not csv_file.exists():
        print(f"    File not found: {csv_file}")
        return 0

    cursor = conn.cursor()
    count = 0

    try:
        cursor.execute("SELECT id, name FROM azs")
        station_map = {row[1]: row[0] for row in cursor.fetchall()}

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=',')
            row_count = 0

            for row in reader:
                row_count += 1

                # Extract station info from first column
                station_info = row.get('АЗС', '') or row.get('station', '')

                # Try to find station in map
                azs_id = None
                for station_name, sid in station_map.items():
                    if 'АЗС' in station_info or any(str(num) in station_info for num in ['172', '173', '603', '604']):
                        for key in station_map.keys():
                            if any(str(num) in key for num in station_info.split()):
                                azs_id = station_map[key]
                                break
                        break

                if not azs_id:
                    continue

                try:
                    competitor = row.get('Конкурент', 'Unknown')
                    fuel = row.get('Топливо', 'A95')
                    price_str = row.get('Цена', '0')

                    price = float((price_str or '0').replace(',', '.'))

                    if price > 0:
                        cursor.execute("""
                            INSERT INTO competitor_prices (azs_id, competitor_name, fuel_type, price, distance_km)
                            VALUES (%s, %s, %s, %s, %s)
                        """, (azs_id, competitor, fuel, price, 0))

                        count += 1
                except (ValueError, TypeError):
                    continue

                if row_count % 1000 == 0:
                    conn.commit()

        conn.commit()
        print(f"    [OK] Loaded {count} competitor prices")
    except Exception as e:
        conn.rollback()
        print(f"    [WARN] {e}")
    finally:
        cursor.close()

    return count

def load_weather(conn):
    print("\n[4/6] Loading WEATHER DATA from weather_data.csv...")

    csv_file = DATA_DIR / 'weather_data.csv'
    if not csv_file.exists():
        print(f"    File not found: {csv_file}")
        return 0

    cursor = conn.cursor()
    count = 0

    try:
        cursor.execute("SELECT id, name FROM azs")
        station_map = {row[1]: row[0] for row in cursor.fetchall()}

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')

            for row in reader:
                station_name = row.get('Название АЗС', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    date_str = row.get('Дата', '')
                    record_date = datetime.strptime(date_str, '%Y-%m-%d').date()

                    cursor.execute("""
                        INSERT INTO weather_data (azs_id, temperature, humidity, wind_speed, conditions, date_recorded)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (azs_id, None, None, None, 'Unknown', record_date))

                    count += 1
                except (ValueError, TypeError):
                    continue

        conn.commit()
        print(f"    [OK] Loaded {count} weather records")
    except Exception as e:
        conn.rollback()
        print(f"    [WARN] {e}")
    finally:
        cursor.close()

    return count

def load_promotions(conn):
    print("\n[5/6] Loading PROMOTIONS from promotions.csv...")

    csv_file = DATA_DIR / 'promotions.csv'
    if not csv_file.exists():
        print(f"    File not found: {csv_file}")
        return 0

    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')

            for row in reader:
                count += 1

        print(f"    [INFO] Found {count} promotion records (table not implemented)")
        return 0
    except Exception as e:
        print(f"    [WARN] {e}")
        return 0

def load_traffic(conn):
    print("\n[6/6] Loading TRAFFIC DATA from traffic_data.csv...")

    csv_file = DATA_DIR / 'traffic_data.csv'
    if not csv_file.exists():
        print(f"    File not found: {csv_file}")
        return 0

    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')

            for row in reader:
                count += 1

        print(f"    [INFO] Found {count} traffic records (table not implemented)")
        return 0
    except Exception as e:
        print(f"    [WARN] {e}")
        return 0

def main():
    print("=" * 70)
    print("AZS-Pult v2.1 - Complete Data Import Tool")
    print("=" * 70)

    conn = connect_db()

    total = 0
    total += load_stations(conn)
    total += load_prices_and_sales(conn)
    total += load_competitor_prices(conn)
    total += load_weather(conn)
    total += load_promotions(conn)
    total += load_traffic(conn)

    conn.close()

    print("\n" + "=" * 70)
    print(f"[SUCCESS] Import completed: {total} records loaded")
    print("=" * 70)

if __name__ == '__main__':
    main()
