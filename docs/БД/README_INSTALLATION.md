# Установка и запуск загрузки цен конкурентов

## 📦 Файлы

```
fix_competitor_prices_with_time.py     - Основной скрипт загрузки
COMPETITOR_PRICES_REQUIREMENTS.md      - Требования к БД и формату данных
README_INSTALLATION.md                 - Этот файл
competitor_prices.csv                  - Исходные данные (ваш файл)
```

---

## 📋 Предварительные проверки

### 1️⃣ Проверить схему БД

Убедись, что таблица существует:

```bash
sudo -u postgres psql azs_pult -c "\d competitor_price_history"
```

Должно вывести структуру таблицы с полем `created_at` типа `TIMESTAMP`.

### 2️⃣ Проверить наличие всех брендов

```bash
sudo -u postgres psql azs_pult -c "
SELECT brand_name, COUNT(*) as stations
FROM competitor
GROUP BY brand_name
ORDER BY brand_name;
"
```

Ожидается:
```
Газпромнефть      5
ЛУКОЙЛ            5
Роснефть          5
Сургутнефтегаз    5
```

### 3️⃣ Проверить наличие всех типов топлива

```bash
sudo -u postgres psql azs_pult -c "SELECT code FROM fuel_type ORDER BY code;"
```

Ожидается минимум:
```
AI92
AI92_BIO
AI95
AI95_BIO
AI100_BIO
DT
DT_BIO
SUS
```

### 4️⃣ Проверить наличие газовых станций

```bash
sudo -u postgres psql azs_pult -c "
SELECT external_id FROM gas_station ORDER BY external_id;
"
```

Ожидается:
```
АЗС 172
АЗС 173
АЗС 603
АЗС 604
АЗС 606
```

---

## 🚀 Запуск скрипта

### Шаг 1: Поместить CSV файл в доступное место

```bash
# Скрипт ищет файл здесь:
/root/.claude/uploads/3dc70862-10d6-53fb-b05f-d49ed034075c/raw/competitor_prices.csv

# Или измени переменную DATA_DIR в скрипте
```

### Шаг 2: Запустить скрипт

```bash
python3 fix_competitor_prices_with_time.py
```

### Шаг 3: Мониторить процесс

Скрипт выведет:
```
================================================================================
АЗС-Пульт - Загрузка ВСЕ цен конкурентов с временем суток
================================================================================
...
✓ Обработано 5000/27345
✓ Обработано 10000/27345
✓ Обработано 15000/27345
✓ Обработано 20000/27345
✓ Обработано 25000/27345

✓ Данные о ценах загружены
```

### Ожидаемое время:
- Обработка CSV: ~10-30 секунд
- Вставка в БД: ~2-5 минут
- **Всего: 5-10 минут**

---

## ✅ Проверка результата

### После завершения скрипт покажет:

#### 1. Сводка по ценам
```
total_records        | 27345
competitors          | 12 (4 бренда × 3 станции на среднем)
fuel_types           | 8
first_datetime       | 2025-06-03 00:00:00+00
last_datetime        | 2026-09-21 13:15:00+00
```

#### 2. Разбивка по брендам и топливу
```
Газпромнефть   | AI100_BIO |     573
Газпромнефть   | AI92      |    1144
...
```

#### 3. Распределение обновлений по часам
```
hour |  records
------|----------
    0 |   24296
    1 |    2231
    2 |     568
    3 |      29
```

---

## 🔍 Ручная проверка после загрузки

### Запрос 1: Всего записей

```sql
SELECT COUNT(*) as total_records
FROM competitor_price_history;
```

Ожидается: **27,345**

### Запрос 2: По брендам

```sql
SELECT 
    c.brand_name,
    COUNT(*) as records,
    COUNT(DISTINCT created_at) as unique_datetimes
FROM competitor_price_history cph
JOIN competitor c ON cph.competitor_id = c.id
GROUP BY c.brand_name
ORDER BY c.brand_name;
```

Ожидается:
```
Газпромнефть    13,727    ~5,900
ЛУКОЙЛ           4,717    ~2,100
Роснефть         7,751    ~3,200
Сургутнефтегаз   1,150      ~500
```

### Запрос 3: Диапазон дат

```sql
SELECT 
    MIN(created_at::DATE) as first_date,
    MAX(created_at::DATE) as last_date,
    COUNT(DISTINCT created_at::DATE) as total_dates
FROM competitor_price_history;
```

Ожидается:
```
2025-06-03 | 2026-09-21 | 476
```

### Запрос 4: Обновления в течение дня

```sql
SELECT 
    EXTRACT(HOUR FROM created_at)::INT as hour,
    COUNT(*) as records
FROM competitor_price_history
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour;
```

Ожидается видеть обновления не только в 00:xx, но и в 01:xx, 02:xx и т.д.

---

## ⚠️ Решение проблем

### Проблема: "Connection refused"

```
psql: error: connection to server on socket failed
```

**Решение:**
```bash
# Проверить статус PostgreSQL
sudo systemctl status postgresql

# Запустить если не запущен
sudo systemctl start postgresql
```

### Проблема: "UNIQUE constraint violation"

Это нормально при повторном запуске - `ON CONFLICT DO UPDATE` обновит существующие записи.

### Проблема: "relation does not exist"

Убедись, что таблица создана:
```bash
sudo -u postgres psql azs_pult -c "\dt competitor_price_history"
```

### Проблема: Медленная загрузка

Проверь индексы (они должны быть созданы):
```bash
sudo -u postgres psql azs_pult -c "\d competitor_price_history"
```

---

## 📊 Ожидаемые результаты

После успешной загрузки:

| Метрика | Значение |
|---------|----------|
| Всего записей | 27,345 |
| Конкурентов | 12+ |
| Типов топлива | 8 |
| Станций | 5 |
| Дней данных | 476 |
| Охват | 100% ✅ |

---

## 🎯 Дальнейшие действия

### 1. Аналитика

```sql
-- Средняя цена за день по типам топлива
SELECT 
    DATE(created_at) as date,
    ft.code,
    ROUND(AVG(price_rub), 2) as avg_price,
    ROUND(MIN(price_rub), 2) as min_price,
    ROUND(MAX(price_rub), 2) as max_price
FROM competitor_price_history cph
JOIN fuel_type ft ON cph.fuel_type_id = ft.id
GROUP BY DATE(created_at), ft.code
ORDER BY date DESC, ft.code;
```

### 2. Тренды изменения цен

```sql
-- Как меняются цены через время
SELECT 
    DATE(created_at) as date,
    EXTRACT(HOUR FROM created_at)::INT as hour,
    c.brand_name,
    ft.code,
    ROUND(AVG(price_rub), 2) as avg_price
FROM competitor_price_history cph
JOIN competitor c ON cph.competitor_id = c.id
JOIN fuel_type ft ON cph.fuel_type_id = ft.id
WHERE c.brand_name = 'Газпромнефть' AND ft.code = 'AI95'
GROUP BY date, hour, c.brand_name, ft.code
ORDER BY date DESC, hour;
```

### 3. Сравнение конкурентов

```sql
-- Кто дешевле? (последние цены)
SELECT 
    DATE(cph.created_at) as date,
    c.brand_name,
    ft.code,
    ROUND(MAX(cph.price_rub), 2) as latest_price
FROM competitor_price_history cph
JOIN competitor c ON cph.competitor_id = c.id
JOIN fuel_type ft ON cph.fuel_type_id = ft.id
WHERE cph.created_at::DATE = CURRENT_DATE - 1
GROUP BY date, c.brand_name, ft.code
ORDER BY ft.code, latest_price;
```

---

## 📞 Поддержка

Если возникли проблемы:

1. Проверь требования в `COMPETITOR_PRICES_REQUIREMENTS.md`
2. Убедись, что все таблицы и связи существуют
3. Запусти скрипт с verbose output для отладки

---

**Версия:** 1.0  
**Дата:** 2026-10-07  
**Статус:** ✅ Production Ready
