#!/usr/bin/env python3
"""
Load ALL fuel types from CSV into database
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

def load_all_fuel_types():
    print("=" * 70)
    print("Loading ALL FUEL TYPES from prices.csv")
    print("=" * 70)
    print()

    csv_file = DATA_DIR / 'prices.csv'
    if not csv_file.exists():
        print("[ERROR] prices.csv not found")
        return

    conn = connect_db()
    cursor = conn.cursor()
    count = 0

    try:
        # Get station mapping
        cursor.execute("SELECT id, name FROM azs")
        station_map = {row[1]: row[0] for row in cursor.fetchall()}

        # All fuel types from CSV
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

        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=';')
            row_num = 0

            for row in reader:
                row_num += 1
                if row_num % 500 == 0:
                    conn.commit()
                    print(f"  Processed {row_num} rows...")

                station_name = row.get('Название АЗС', '')
                azs_id = station_map.get(station_name)

                if not azs_id:
                    continue

                try:
                    date_str = row.get('Временная метка', '')
                    record_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                except:
                    continue

                for fuel_type, (sales_key, price_key) in fuel_types.items():
                    try:
                        sales = float((row.get(sales_key, '0') or '0').replace(',', '.'))
                        price = float((row.get(price_key, '0') or '0').replace(',', '.'))

                        if sales > 0 and price > 0:
                            # Insert price
                            cursor.execute("""
                                INSERT INTO prices (azs_id, fuel_type, price, trend, updated_at)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (azs_id, fuel_type)
                                DO UPDATE SET price = EXCLUDED.price
                            """, (azs_id, fuel_type, price, 'stable', record_date))

                            # Insert sales
                            revenue = sales * price
                            cursor.execute("""
                                INSERT INTO sales_data (azs_id, fuel_type, volume, revenue, date_recorded)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (azs_id, fuel_type, sales, revenue, record_date))

                            count += 1
                    except (ValueError, TypeError):
                        continue

        conn.commit()

        print(f"\n[SUCCESS] Loaded {count} records (ALL fuel types)")
        print()

        # Show statistics
        cursor.execute("SELECT fuel_type, COUNT(*) FROM sales_data GROUP BY fuel_type ORDER BY count DESC")
        print("Fuel types loaded:")
        for fuel_type, cnt in cursor.fetchall():
            print(f"  ✓ {fuel_type}: {cnt} records")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    load_all_fuel_types()
