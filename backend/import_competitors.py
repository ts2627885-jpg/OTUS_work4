#!/usr/bin/env python3
"""
Import competitor prices from CSV
"""

import os
import sys
import csv
import psycopg2
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
        print(f"[OK] Connected to {DB_NAME}")
        return conn
    except psycopg2.Error as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

def main():
    print("=" * 60)
    print("Loading Competitor Prices (50000+ records)")
    print("=" * 60)

    csv_file = DATA_DIR / 'competitor_prices.csv'
    if not csv_file.exists():
        print(f"[ERROR] File not found: {csv_file}")
        return

    conn = connect_db()
    cursor = conn.cursor()
    count = 0

    try:
        # Get station mapping
        cursor.execute("SELECT id, name FROM azs")
        station_map = {row[1]: row[0] for row in cursor.fetchall()}

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')

            for row in reader:
                try:
                    station_name = row.get('Название АЗС', '')
                    azs_id = station_map.get(station_name)

                    if not azs_id:
                        continue

                    # Extract price from value field
                    price_str = row.get('Значение', '0')
                    try:
                        price = float((price_str or '0').replace(',', '.'))
                    except:
                        continue

                    if price <= 0:
                        continue

                    # Get competitor name and fuel type from description
                    description = row.get('Описание', '')
                    variable = row.get('Переменная', '')
                    brand = row.get('Brand', 'Unknown')

                    fuel_type = 'A95'
                    if 'AI92' in variable or 'АИ-92' in variable:
                        fuel_type = 'A92'
                    elif 'AI95' in variable or 'АИ-95' in variable:
                        fuel_type = 'A95'
                    elif 'AI98' in variable or 'АИ-98' in variable:
                        fuel_type = 'A98'
                    elif 'DT' in variable or 'ДТ' in variable:
                        fuel_type = 'DT'

                    cursor.execute("""
                        INSERT INTO competitor_prices
                        (azs_id, competitor_name, fuel_type, price, distance_km)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (azs_id, brand, fuel_type, price, 0))

                    count += 1

                    if count % 5000 == 0:
                        conn.commit()
                        print(f"    Loaded {count} records...")

                except Exception as e:
                    continue

        conn.commit()
        print(f"\n[OK] Loaded {count} competitor price records")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] {e}")
    finally:
        cursor.close()
        conn.close()

    print("=" * 60)

if __name__ == '__main__':
    main()
