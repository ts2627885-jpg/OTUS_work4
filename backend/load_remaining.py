#!/usr/bin/env python3
"""
Load remaining data: promotions, shop_sales, traffic_data
"""

import os
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

def main():
    print("=" * 70)
    print("Loading REMAINING DATA files")
    print("=" * 70)
    print()

    # =====================================
    # 1. PROMOTIONS.CSV
    # =====================================
    print("[1/3] PROMOTIONS.CSV")
    csv_file = DATA_DIR / 'promotions.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                count += 1
        print(f"      ℹ️  Found {count} promotion records")
        print(f"      ⚠️  Table not implemented (table doesn't exist in schema)")
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # =====================================
    # 2. SHOP_SALES.CSV
    # =====================================
    print("[2/3] SHOP_SALES.CSV")
    csv_file = DATA_DIR / 'shop_sales.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                count += 1
        print(f"      ℹ️  Found {count} shop sales records")
        print(f"      ⚠️  Table not implemented (table doesn't exist in schema)")
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()

    # =====================================
    # 3. TRAFFIC_DATA.CSV
    # =====================================
    print("[3/3] TRAFFIC_DATA.CSV")
    csv_file = DATA_DIR / 'traffic_data.csv'
    count = 0

    try:
        with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                count += 1
        print(f"      ℹ️  Found {count} traffic records")
        print(f"      ⚠️  Table not implemented (table doesn't exist in schema)")
    except Exception as e:
        print(f"      ✗ Error: {e}")

    print()
    print("=" * 70)
    print("SUMMARY - Not Implemented (would require schema changes)")
    print("=" * 70)
    print()
    print("These files contain data but require new tables:")
    print()
    print("1. PROMOTIONS (108 records)")
    print("   Columns: promotion_id, name, type, start_date, end_date, discount, status")
    print()
    print("2. SHOP_SALES (35 records)")
    print("   Columns: shop_name, product_type, sales_amount, date")
    print()
    print("3. TRAFFIC_DATA (1,021 records)")
    print("   Columns: date, station, cars, trucks, motorcycles, etc.")
    print()
    print("To load these, you would need to:")
    print("  1. Create new tables in schema.sql")
    print("  2. Add foreign keys to azs table")
    print("  3. Run migrations")
    print()

if __name__ == '__main__':
    main()
