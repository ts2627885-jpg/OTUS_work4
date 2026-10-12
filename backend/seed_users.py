#!/usr/bin/env python3
"""
Create test users and basic AZS stations
"""

import os
import psycopg2
import bcrypt
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'azs_pult')

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')

def main():
    print("=" * 70)
    print("Seeding users and AZS stations")
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

    # Create users
    users = [
        ('admin', 'admin@azs-pult.local', 'admin123', 'admin'),
        ('manager', 'manager@azs-pult.local', 'manager123', 'manager'),
        ('analyst', 'analyst@azs-pult.local', 'analyst123', 'analyst'),
        ('viewer', 'viewer@azs-pult.local', 'viewer123', 'viewer'),
    ]

    print("[1/2] Creating test users...")
    for username, email, password, role in users:
        password_hash = hash_password(password)
        try:
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, role, is_active)
                VALUES (%s, %s, %s, %s, true)
            """, (username, email, password_hash, role))
            print(f"      ✓ {username} ({role})")
        except:
            print(f"      ✗ {username} - already exists")

    conn.commit()
    print()

    # Create AZS stations
    stations = [
        ('АЗС 172', 'ул. Советская, 45', 'Tver region', ['A92', 'A95', 'DT']),
        ('АЗС 173', 'ул. Пролетарская, 78', 'Tver region', ['A92', 'A95', 'DT', 'SUG']),
        ('АЗС 603', 'ул. Октябрьская, 12', 'Tver region', ['A92', 'A95', 'DT', 'KPG']),
        ('АЗС 604', 'ул. Центральная, 34', 'Tver region', ['A92', 'A95', 'DT']),
    ]

    print("[2/2] Creating AZS stations...")
    for name, address, region, fuels in stations:
        try:
            cursor.execute("""
                INSERT INTO azs (name, address, region, fuel_types, status)
                VALUES (%s, %s, %s, %s, 'active')
            """, (name, address, region, fuels))
            print(f"      ✓ {name}")
        except:
            print(f"      ✗ {name} - already exists")

    conn.commit()
    print()
    print("=" * 70)
    print("✅ Seeding completed")
    print("=" * 70)
    print()
    print("Test users:")
    for username, email, password, role in users:
        print(f"  - {username}: {password} ({role})")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
