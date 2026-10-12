#!/usr/bin/env python3
"""
Загрузить ВСЕ цены конкурентов с полной временной меткой (дата + время)
"""

import csv
import subprocess

DATA_DIR = '/root/.claude/uploads/3dc70862-10d6-53fb-b05f-d49ed034075c/raw'
DB = 'azs_pult'
DB_USER = 'postgres'

def exec_sql(sql_statements):
    """Выполнить SQL через psql"""
    try:
        process = subprocess.Popen(
            ['sudo', '-u', DB_USER, 'psql', DB],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(input=sql_statements, timeout=600)
        if process.returncode != 0:
            return False, stderr[:300]
        return True, ""
    except Exception as e:
        return False, str(e)

print("=" * 80)
print("АЗС-Пульт - Загрузка ВСЕ цен конкурентов с временем суток")
print("=" * 80)

# Получить маппинг станций
process = subprocess.Popen(
    ['sudo', '-u', DB_USER, 'psql', DB, '-t'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)
stdout, _ = process.communicate(input="SELECT external_id, id FROM gas_station ORDER BY external_id;")

station_map = {}
for line in stdout.strip().split('\n'):
    if '|' in line:
        parts = line.split('|')
        station_map[parts[0].strip()] = parts[1].strip()

# Получить доступные типы топлива
process = subprocess.Popen(
    ['sudo', '-u', DB_USER, 'psql', DB, '-t'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)
stdout, _ = process.communicate(input="SELECT code FROM fuel_type ORDER BY code;")

db_fuel_types = set()
for line in stdout.strip().split('\n'):
    if line.strip():
        db_fuel_types.add(line.strip())

print(f"Доступные типы топлива: {sorted(db_fuel_types)}")

def extract_fuel_type(variable):
    """Извлечь тип топлива с правильной обработкой BIO вариантов"""
    fuel = variable.replace('competitor_price_', '').upper()
    is_bio = '_' in fuel or 'BIO' in fuel
    fuel = fuel.replace('_BREND', '').replace('BREND', '').replace('_BIO', '').strip()

    if fuel == 'AI92':
        return 'AI92_BIO' if is_bio else 'AI92'
    elif fuel == 'AI95':
        return 'AI95_BIO' if is_bio else 'AI95'
    elif fuel == 'AI100':
        return 'AI100_BIO'
    elif fuel == 'DT':
        return 'DT_BIO' if is_bio else 'DT'
    elif fuel in ['KPG', 'SPG', 'SUG']:
        return 'SUS'
    else:
        return 'AI92'

def parse_datetime(timestamp_str):
    """
    Преобразовать временную метку в ISO формат для PostgreSQL
    DD.MM.YYYY_HH:MM:SS -> YYYY-MM-DD HH:MM:SS
    """
    if not timestamp_str or '_' not in timestamp_str:
        return None

    try:
        date_part, time_part = timestamp_str.split('_', 1)
        day, month, year = date_part.split('.')
        return f"{year}-{month}-{day} {time_part}"
    except:
        return None

# Загрузить цены
print("\nЗагрузка цен с ПОЛНОЙ временной меткой (дата + время)...\n")

sql_inserts = []
row_count = 0
success_count = 0
skipped_count = 0
time_stats = {}  # Статистика по времени суток
brand_stats = {}

with open(f'{DATA_DIR}/competitor_prices.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f, delimiter=';')

    for row in reader:
        row_count += 1

        station_name = row.get('Название АЗС', '').strip()
        brand = row.get('Brand', '').strip()
        price_str = row.get('Значение', '0').strip().replace(',', '.')
        timestamp_str = row.get('Временная метка', '').strip()
        variable = row.get('Переменная', '').strip()

        if not station_name or not brand or not price_str or not timestamp_str or not variable:
            skipped_count += 1
            continue

        try:
            price = float(price_str)
            if price < 0 or price > 100000:
                skipped_count += 1
                continue
            if price == 0:
                skipped_count += 1
                continue
        except:
            skipped_count += 1
            continue

        # Преобразовать временную метку
        datetime_str = parse_datetime(timestamp_str)
        if not datetime_str:
            skipped_count += 1
            continue

        # Извлечь тип топлива
        fuel_code = extract_fuel_type(variable)

        if fuel_code not in db_fuel_types:
            skipped_count += 1
            continue

        # Найти соответствующую станцию
        matching_station = None
        for db_station in station_map.keys():
            if (station_name in db_station or db_station in station_name or
                station_name.replace(' ', '') == db_station.replace(' ', '')):
                matching_station = db_station
                break

        if not matching_station:
            skipped_count += 1
            continue

        gas_station_id = station_map[matching_station]

        # SQL для вставки
        sql = f"""
INSERT INTO competitor_price_history (competitor_id, fuel_type_id, price_rub, created_at)
SELECT c.id, ft.id, {price}, '{datetime_str}'::TIMESTAMP
FROM competitor c, fuel_type ft
WHERE c.brand_name = '{brand}' AND ft.code = '{fuel_code}'
AND c.gas_station_id = '{gas_station_id}'::UUID
ON CONFLICT (competitor_id, fuel_type_id, created_at) DO UPDATE
SET price_rub = {price};
"""
        sql_inserts.append(sql)
        success_count += 1

        # Сбор статистики
        if brand not in brand_stats:
            brand_stats[brand] = 0
        brand_stats[brand] += 1

        # Время суток
        time_part = datetime_str.split(' ')[1]  # HH:MM:SS
        if time_part not in time_stats:
            time_stats[time_part] = 0
        time_stats[time_part] += 1

print(f"Строк обработано: {row_count:,}")
print(f"Валидных цен: {success_count:,}")
print(f"Пропущено: {skipped_count:,}")

print(f"\nРаспределение по брендам:")
for brand in sorted(brand_stats.keys()):
    count = brand_stats[brand]
    pct = 100.0 * count / success_count
    print(f"  {brand:.<30} {count:>6,}  ({pct:>5.1f}%)")

print(f"\nТоп 15 времён суток с обновлениями цен:")
for time_str in sorted(time_stats.keys(), key=lambda x: -time_stats[x])[:15]:
    count = time_stats[time_str]
    pct = 100.0 * count / success_count
    print(f"  {time_str}: {count:>6,}  ({pct:>5.1f}%)")

# Очистить существующие данные
print("\n" + "=" * 80)
print("Очистка существующих цен...")
exec_sql("DELETE FROM competitor_price_history;")

# Выполнить пакетно
if sql_inserts:
    batch_size = 500
    for i in range(0, len(sql_inserts), batch_size):
        batch = '\n'.join(sql_inserts[i:i+batch_size])
        success, error = exec_sql(batch)
        if not success:
            print(f"  ✗ Ошибка в пакете {i//batch_size}: {error}")
        if (i // batch_size + 1) % 10 == 0:
            print(f"  ✓ Обработано {min(i + batch_size, len(sql_inserts)):,}/{len(sql_inserts):,}")

    print(f"\n✓ Данные о ценах загружены")

# Проверка
print("\n" + "=" * 80)
print("ПРОВЕРКА РЕЗУЛЬТАТА")
print("=" * 80)

process = subprocess.Popen(
    ['sudo', '-u', DB_USER, 'psql', DB, '-t'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)
stdout, _ = process.communicate(input="""
SELECT
    COUNT(*) as total_records,
    COUNT(DISTINCT competitor_id) as competitors,
    COUNT(DISTINCT fuel_type_id) as fuel_types,
    MIN(created_at) as first_datetime,
    MAX(created_at) as last_datetime
FROM competitor_price_history;
""")
print("\nСводка по ценам конкурентов:")
print(stdout)

process = subprocess.Popen(
    ['sudo', '-u', DB_USER, 'psql', DB, '-t'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)
stdout, _ = process.communicate(input="""
SELECT
    c.brand_name,
    ft.code,
    COUNT(*) as records,
    MIN(cph.created_at)::DATE as first_date,
    MAX(cph.created_at)::DATE as last_date
FROM competitor_price_history cph
JOIN competitor c ON cph.competitor_id = c.id
JOIN fuel_type ft ON cph.fuel_type_id = ft.id
GROUP BY c.brand_name, ft.code
ORDER BY c.brand_name, ft.code;
""")
print(f"\nРазбивка по брендам и топливу:\n{stdout}")

# Статистика по времени обновлений
process = subprocess.Popen(
    ['sudo', '-u', DB_USER, 'psql', DB, '-t'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)
stdout, _ = process.communicate(input="""
SELECT
    EXTRACT(HOUR FROM created_at)::INT as hour,
    COUNT(*) as records
FROM competitor_price_history
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour;
""")
print(f"\nРаспределение обновлений по часам суток:\n{stdout}")

print("\n" + "=" * 80)
print("✅ Загрузка цен конкурентов завершена!")
print("=" * 80)
