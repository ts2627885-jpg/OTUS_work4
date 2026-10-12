#!/usr/bin/env python3
"""
Load weather data from CSV
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
    print("Loading WEATHER DATA from weather_data.csv")
    print("=" * 70)
    print()

    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    cursor = conn.cursor()

    # Get station mapping
    cursor.execute("SELECT id, name FROM azs")
    station_map = {row[1]: row[0] for row in cursor.fetchall()}

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

                except Exception as e:
                    continue

        conn.commit()
        print(f"[SUCCESS] Loaded {count:,} weather records")
        print()

        # Verify
        cursor.execute("SELECT COUNT(*) FROM weather_data")
        total = cursor.fetchone()[0]
        print(f"Total weather data in database: {total:,}")

    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
