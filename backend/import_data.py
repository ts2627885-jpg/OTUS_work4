#!/usr/bin/env python3
"""
Import CSV data into PostgreSQL for AZS-Pult system.
Reads CSV files from _data folder and loads them into the database.
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
    """Connect to PostgreSQL database"""
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
    """Load stations from stations.csv"""
    print("\n[*] Loading stations...")

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

def load_prices(conn):
    """Load price data from prices.csv"""
    print("\n[*] Loading prices and sales...")

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

            for row in reader:
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
                        sales = float((row.get(sales_key) or '0').replace(',', '.'))
                        price = float((row.get(price_key) or '0').replace(',', '.'))

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

        conn.commit()
        print(f"    [OK] Loaded {count} price records")
    except Exception as e:
        conn.rollback()
        print(f"    [ERROR] {e}")
    finally:
        cursor.close()

    return count

def load_weather(conn):
    """Load weather data from weather_data.csv"""
    print("\n[*] Loading weather data...")

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
                        INSERT INTO weather_data (azs_id, temperature, conditions, date_recorded)
                        VALUES (%s, %s, %s, %s)
                    """, (azs_id, None, 'Unknown', record_date))

                    count += 1
                except (ValueError, TypeError):
                    continue

        conn.commit()
        print(f"    [OK] Loaded {count} weather records")
    except Exception as e:
        conn.rollback()
        print(f"    [ERROR] {e}")
    finally:
        cursor.close()

    return count

def main():
    """Main import function"""
    print("=" * 60)
    print("AZS-Pult v2.1 - Data Import Tool")
    print("=" * 60)

    conn = connect_db()

    total = 0
    total += load_stations(conn)
    total += load_prices(conn)
    total += load_weather(conn)

    conn.close()

    print("\n" + "=" * 60)
    print(f"[SUCCESS] Import completed: {total} records loaded")
    print("=" * 60)

if __name__ == '__main__':
    main()
