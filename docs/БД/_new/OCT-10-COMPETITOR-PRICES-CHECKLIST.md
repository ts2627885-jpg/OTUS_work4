# 🔗 Oct 10: Чек-лист загрузки цен конкурентов
**Перед развертыванием FR-007**

**Дата:** 10 октября 2026  
**Окно:** 22:30–23:00 UTC (перед FR-007 deployment)  
**Статус:** Critical pre-deployment task

---

## ⏰ ВРЕМЕННАЯ ШКАЛА

```
22:00 UTC  - Сборка команды (КОНК-1/2 deployment)
22:30 UTC  - НАЧАЛО: Загрузка цен конкурентов ← ВАРИАНТ 1
            ИЛИ
22:45 UTC  - Окончание: Проверка всех БД данных
23:00 UTC  - НАЧАЛО: FR-007 deployment ← КОНК-1/2 с новыми данными
23:30 UTC  - Окончание: Мониторинг стабильности
```

---

## 📋 ДО ЗАГРУЗКИ (22:00–22:30 UTC)

### ✅ Проверка 1: PostgreSQL запущен

```bash
sudo systemctl status postgresql

# Если нет - запустить:
sudo systemctl start postgresql
```

**Результат:** Service is active (running) ✅

### ✅ Проверка 2: БД доступна

```bash
sudo -u postgres psql azs_pult -c "SELECT version();"
```

**Результат:** PostgreSQL version выведен ✅

### ✅ Проверка 3: Таблица создана

```bash
sudo -u postgres psql azs_pult -c "\d competitor_price_history"
```

**Ожидаемая структура:**
```
                  Table "public.competitor_price_history"
     Column      |           Type           | Collation | Nullable | Default
-----------------+--------------------------+-----------+----------+---------
 id              | uuid                     |           | not null | gen_random_uuid()
 competitor_id   | uuid                     |           | not null |
 fuel_type_id    | uuid                     |           | not null |
 price_rub       | numeric(10,2)            |           | not null |
 created_at      | timestamp with time zone |           | not null |

Indexes:
    "competitor_price_history_pkey" PRIMARY KEY, btree (id)
    "competitor_price_history_competitor_id_fuel_type_id_created_at_key" UNIQUE, btree (competitor_id, fuel_type_id, created_at)
    "idx_competitor_price_history_competitor_id" btree (competitor_id)
    "idx_competitor_price_history_created_at" btree (created_at DESC)
```

**Результат:** ✅ ОК или 🔴 Нужно создать

### ✅ Проверка 4: Все брэнды существуют

```bash
sudo -u postgres psql azs_pult << 'EOF'
SELECT brand_name, COUNT(*) as stations
FROM competitor
GROUP BY brand_name
ORDER BY brand_name;
EOF
```

**Ожидаемый результат:**
```
  brand_name    | stations
-----------------+----------
 Газпромнефть    |        5
 ЛУКОЙЛ          |        5
 Роснефть        |        5
 Сургутнефтегаз  |        5
```

**Результат:** ✅ ОК

### ✅ Проверка 5: Все типы топлива существуют

```bash
sudo -u postgres psql azs_pult -c "
SELECT code FROM fuel_type 
WHERE code IN ('AI92','AI92_BIO','AI95','AI95_BIO','AI100_BIO','DT','DT_BIO','SUS')
ORDER BY code;"
```

**Ожидаемый результат:** 8 типов топлива ✅

### ✅ Проверка 6: CSV файл на месте

```bash
ls -lh /root/.claude/uploads/3dc70862-10d6-53fb-b05f-d49ed034075c/raw/competitor_prices.csv
```

**Ожидаемый результат:** 12.4 MB файл существует ✅

### ✅ Проверка 7: Python 3 готов

```bash
python3 --version
```

**Ожидаемый результат:** Python 3.8+ ✅

---

## 🚀 ЗАГРУЗКА ЦЕН (22:30 UTC)

### Шаг 1: Запустить скрипт

```bash
python3 fix_competitor_prices_with_time.py

# Ожидаемое время: 5-10 минут
# Скрипт выведет прогресс...
```

### Ожидаемый вывод:

```
================================================================================
🚀 АЗС-Пульт - Загрузка ВСЕ цен конкурентов с временем суток
================================================================================

📍 Этап 1: Загрузка маппинга станций...
✓ Загружено станций: 5
  - АЗС 172
  - АЗС 173
  - АЗС 603
  - АЗС 604
  - АЗС 606

⛽ Этап 2: Загрузка типов топлива...
✓ Доступные типы топлива: ['AI100_BIO', 'AI92', 'AI92_BIO', 'AI95', ...]

📊 Этап 3: Загрузка и валидация цен...

📈 Статистика валидации:
  Строк обработано:  59,942
  Валидных цен:      27,345 ✅
  Пропущено:         32,597

✓ Распределение по брендам:
  Газпромнефть.......13,727 (50.2%)
  Роснефть...........7,751 (28.3%)
  ЛУКОЙЛ.............4,717 (17.2%)
  Сургутнефтегаз....1,150 (4.2%)

📤 Загрузка 27345 записей пакетами по 500...
  ✓ 5000/27345 записей загружено
  ✓ 10000/27345 записей загружено
  ✓ 15000/27345 записей загружено
  ✓ 20000/27345 записей загружено
  ✓ 25000/27345 записей загружено

✅ Загрузка данных завершена

================================================================================
✅ ПРОВЕРКА РЕЗУЛЬТАТА
================================================================================

📊 Сводка по ценам конкурентов:
 total_records | competitors | fuel_types | unique_dates | first_datetime | last_datetime
    27345      |     12      |      8     |     476      | 2025-06-03...  | 2026-09-21...

✅ ЗАГРУЗКА ЦЕН КОНКУРЕНТОВ УСПЕШНО ЗАВЕРШЕНА!
================================================================================
```

---

## ✅ ПОСЛЕ ЗАГРУЗКИ (22:40–22:55 UTC)

### Запрос 1: Проверить количество записей

```bash
sudo -u postgres psql azs_pult -c \
  "SELECT COUNT(*) as total FROM competitor_price_history;"
```

**Ожидается:** `27345` ✅

### Запрос 2: Проверить диапазон дат

```bash
sudo -u postgres psql azs_pult << 'EOF'
SELECT 
    MIN(created_at::DATE) as first_date,
    MAX(created_at::DATE) as last_date,
    COUNT(DISTINCT created_at::DATE) as total_dates
FROM competitor_price_history;
EOF
```

**Ожидается:**
```
 first_date | last_date  | total_dates
 2025-06-03 | 2026-09-21 |    476
```
✅

### Запрос 3: Проверить временные обновления

```bash
sudo -u postgres psql azs_pult << 'EOF'
SELECT 
    EXTRACT(HOUR FROM created_at)::INT as hour,
    COUNT(*) as records
FROM competitor_price_history
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour
LIMIT 15;
EOF
```

**Ожидается видеть:**
```
 hour | records
------+---------
    0 | 24296    ← Дефолтное время (полночь)
    1 | 2231     ← РЕАЛЬНЫЕ изменения!
    2 | 568      ← Динамика цен
    3 | 29
   ...
```

✅ Если видны записи с 01:xx, 02:xx - успех!

### Запрос 4: Проверить брэнды

```bash
sudo -u postgres psql azs_pult << 'EOF'
SELECT 
    c.brand_name,
    COUNT(*) as records
FROM competitor_price_history cph
JOIN competitor c ON cph.competitor_id = c.id
GROUP BY c.brand_name
ORDER BY c.brand_name;
EOF
```

**Ожидается:**
```
  brand_name    | records
-----------------+---------
 Газпромнефть    | 13727
 ЛУКОЙЛ          | 4717
 Роснефть        | 7751
 Сургутнефтегаз  | 1150
```

✅

---

## 🎯 ЕСЛИ ВСЕ ОК (22:55 UTC)

```
✅ 27,345 записей в БД
✅ Все брэнды загружены
✅ Временные метки полные
✅ Данные готовы к использованию в КОНК-1/2

🚀 ГОТОВО К FR-007 DEPLOYMENT В 23:00 UTC
```

**Действие:** Продолжить к `OCT-10-PRE-DEPLOYMENT-CHECKLIST.md`

---

## 🔴 ЕСЛИ ЧТО-ТО НЕ ОК

### Проблема: "Connection refused"

```bash
# Решение: Запустить PostgreSQL
sudo systemctl start postgresql
sudo systemctl status postgresql
```

### Проблема: "Таблица не существует"

```bash
# Решение: Создать таблицу
# (см. COMPETITOR_PRICES_REQUIREMENTS.md раздел "Требования к БД")

sudo -u postgres psql azs_pult << 'EOF'
CREATE TABLE competitor_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitor(id),
    fuel_type_id UUID NOT NULL REFERENCES fuel_type(id),
    price_rub NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    UNIQUE (competitor_id, fuel_type_id, created_at)
);

CREATE INDEX idx_competitor_price_history_created_at 
    ON competitor_price_history(created_at DESC);
CREATE INDEX idx_competitor_price_history_competitor_id 
    ON competitor_price_history(competitor_id);
EOF
```

### Проблема: "Скрипт не находит CSV"

```bash
# Проверить путь
ls -lh /root/.claude/uploads/3dc70862-10d6-53fb-b05f-d49ed034075c/raw/competitor_prices.csv

# Если нет - обновить переменную DATA_DIR в скрипте
```

### Проблема: Ошибка при загрузке

```bash
# Посмотреть подробные логи
python3 fix_competitor_prices_with_time.py 2>&1 | tee load_prices.log
```

---

## ⏱️ КРИТИЧЕСКИЕ ЗНАЧЕНИЯ ВРЕМЕНИ

| Время | Событие | Статус |
|------|---------|--------|
| 22:00 UTC | Начало сборки (FR-007) | ✅ |
| **22:30 UTC** | **НАЧАЛО: Загрузка цен** | **← ВЫ ЗДЕСЬ** |
| 22:45 UTC | Конец загрузки (ожидается) | ✅ |
| 22:55 UTC | Проверка результата | ✅ |
| 23:00 UTC | НАЧАЛО: FR-007 deployment | ✅ ГОТОВНОСТЬ |
| 23:30 UTC | Мониторинг завершен | ✅ |

**⚠️ ВАЖНО:** Если загрузка займет > 15 минут, начнется с опозданием относительно FR-007 deployment. Убедитесь, что все проверки пройдены до 22:30 UTC.

---

## 📞 КОНТАКТЫ ДЛЯ ПРОБЛЕМ

**Slack:** #fr007-deployment

```
@DevOps: Проблема с загрузкой цен конкурентов
@OnCall: Загрузка прошла успешно, готовы к deployment
```

---

## ✅ ФИНАЛЬНЫЙ ЧЕК-ЛИСТ

- [ ] PostgreSQL запущен
- [ ] БД доступна
- [ ] Таблица создана
- [ ] Все брэнды существуют
- [ ] Все типы топлива существуют
- [ ] CSV файл на месте
- [ ] Python 3 готов
- [ ] Скрипт запущен в 22:30 UTC
- [ ] Скрипт завершен успешно
- [ ] Проверка 1: COUNT(*) = 27345 ✅
- [ ] Проверка 2: Диапазон дат 2025-06-03 → 2026-09-21 ✅
- [ ] Проверка 3: Есть обновления в 01:xx, 02:xx ✅
- [ ] Проверка 4: Все 4 брэнда загружены ✅
- [ ] Готово к FR-007 deployment ✅

---

**Версия:** 1.0  
**Дата:** 2026-10-08  
**Статус:** ✅ Production Ready
