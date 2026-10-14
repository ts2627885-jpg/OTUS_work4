# АЗС-Пульт v2.1 - Данные и БД

## Обзор

Папка `_data` содержит полный набор данных для инициализации и работы системы управления ценами АЗС-Пульт:

- **Период данных**: 01.06.2025 – 07.07.2026 (более 13 месяцев)
- **Количество АЗС**: 5 станций (АЗС 172, 173, 603, 604, 606)
- **Объем**: ~12 МБ CSV файлов
- **Схема БД**: PostgreSQL 15

## Файлы

| Файл | Размер | Записей | Описание |
|------|--------|---------|---------|
| `stations.csv` | 1.9 КБ | 5 | Статические данные о станциях (конфигурация, координаты) |
| `prices.csv` | 680 КБ | 5000+ | Ежедневные цены на топливо и объемы продаж |
| `shop_sales.csv` | 136 КБ | 5 | Ежедневные продажи сопутствующих товаров в магазине |
| `weather_data.csv` | 89 КБ | 5 | Метеорологические данные (температура, влажность, ветер) |
| `traffic_data.csv` | 143 КБ | 5 | Данные о транспортном потоке |
| `competitor_prices.csv` | 12.3 МБ | 50000+ | Цены конкурентов соседних АЗС |
| `promotions.csv` | 19 КБ | 100+ | История акций и специальных предложений |
| `schema.sql` | 9.2 КБ | — | Полная схема БД с индексами и представлениями |

## Быстрый старт

### 1. Инициализация БД

```bash
# Подключение к PostgreSQL
psql -h localhost -U postgres -d postgres

# Создание БД
CREATE DATABASE azs_pult;
\c azs_pult

# Загрузка схемы
\i _data/schema.sql
```

### 2. Создание тестовых пользователей

Пользователей создаёт скрипт `backend/seed_users.py`. Пароли задаются переменными окружения, в репозитории их нет:

```bash
export ADMIN_PASSWORD='<пароль администратора, не короче 8 символов>'
export MANAGER_PASSWORD='<пароль менеджера>'
export ANALYST_PASSWORD='<пароль аналитика>'
export VIEWER_PASSWORD='<пароль наблюдателя>'
cd backend && python seed_users.py
```

Роли: `admin`, `manager`, `analyst`, `viewer`. Пароли не хранятся в документации и не выводятся скриптом.

### 3. Импорт данных из CSV

Используйте скрипт `import_data.py` (находится в корне backend):

```bash
cd backend
python import_data.py
```

Скрипт автоматически:
- Подключается к БД
- Парсит CSV файлы с правильными разделителями
- Загружает данные в соответствующие таблицы
- Выводит статистику импорта

## Структура данных

### stations.csv
Статические характеристики АЗС:
- Базовая информация (ID, название, адрес)
- Расположение (координаты, дорога, тип населенного пункта)
- Инфраструктура (количество насосов по типам топлива, услуги)
- Конкуренция (список и количество конкурентов)

### prices.csv
Ежедневные данные о топливе:
- Объемы продаж по типам топлива (АИ-92, АИ-95, ДТ, СУГ, КПГ, СПГ)
- Цены на каждый вид топлива
- Временные характеристики (день недели, неделя года, сезон)
- Конкурентные данные и показатели лояльности

### weather_data.csv
Метеорологические данные:
- Температура (°C)
- Влажность (%)
- Скорость ветра (м/с)
- Описание погоды (солнечно, облачно, дождь и т.д.)

### traffic_data.csv
Транспортный поток:
- Количество автомобилей по часам
- По типам (легковые, грузовые, мотоциклы)
- Интенсивность трафика

### competitor_prices.csv
Мониторинг конкурентов:
- Названия и расстояния до конкурентов
- Цены на каждый вид топлива
- История обновлений цен

### promotions.csv
История акций:
- Дата начала/окончания
- Описание акции
- Тип (скидка, подарок, лояльность)
- Эффект на продажи

## Запросы для аналитики

### Топ станций по выручке
```sql
SELECT 
  a.name,
  ROUND(SUM(s.revenue)::numeric, 2) as total_revenue,
  ROUND(SUM(s.volume)::numeric, 2) as total_volume,
  COUNT(DISTINCT DATE(s.date_recorded)) as days_recorded
FROM azs a
LEFT JOIN sales_data s ON a.id = s.azs_id
GROUP BY a.id, a.name
ORDER BY total_revenue DESC;
```

### Тренды цен за последний месяц
```sql
SELECT 
  p.azs_id,
  a.name,
  p.fuel_type,
  p.price as current_price,
  p.previous_price,
  ROUND(((p.price - p.previous_price) / p.previous_price * 100)::numeric, 2) as change_percent
FROM prices p
JOIN azs a ON p.azs_id = a.id
ORDER BY ABS(((p.price - p.previous_price) / p.previous_price * 100)) DESC;
```

### Эффективность рекомендаций
```sql
SELECT 
  r.type,
  COUNT(*) as total_count,
  SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  ROUND(AVG(r.confidence)::numeric, 2) as avg_confidence,
  ROUND(AVG(COALESCE(r.estimated_revenue, 0))::numeric, 2) as avg_revenue_impact
FROM recommendations r
GROUP BY r.type;
```

### Анализ конкуренции
```sql
SELECT 
  a.name as our_station,
  cp.competitor_name,
  cp.fuel_type,
  p.price as our_price,
  cp.price as competitor_price,
  ROUND((cp.price - p.price)::numeric, 2) as price_diff,
  cp.distance_km
FROM competitor_prices cp
JOIN azs a ON cp.azs_id = a.id
JOIN prices p ON p.azs_id = a.id AND p.fuel_type = cp.fuel_type
WHERE cp.distance_km < 5
ORDER BY cp.distance_km, price_diff DESC;
```

## Аналитические представления

После загрузки схемы доступны следующие представления:

### v_azs_revenue_summary
Сводка по выручке каждой АЗС:
```sql
SELECT * FROM v_azs_revenue_summary ORDER BY total_revenue DESC;
```

### v_price_trends
Тренды цен на каждой станции:
```sql
SELECT * FROM v_price_trends WHERE price_change_percent != 0;
```

### v_recommendations_stats
Статистика рекомендаций по типам:
```sql
SELECT * FROM v_recommendations_stats;
```

## Структура индексов

БД содержит оптимизированные индексы для быстрого поиска:
- По AZS ID (все таблицы с данными)
- По датам (sales_data, weather_data, price_history)
- По типам топлива (prices)
- По статусам (recommendations)
- По пользователям (audit_logs, import_history)

## Аудит и логирование

### audit_logs
Все изменения цен и рекомендаций логируются:
- Кто изменил
- Что изменилось (старое/новое значение)
- Когда произошло изменение
- IP адрес пользователя

### import_history
Отслеживание всех импортов данных:
- Файл и статус импорта
- Количество записей
- Ошибки (если есть)
- Время импорта

### price_history
Полная история изменения цен:
- От какой цены к какой
- Причина изменения
- Кто изменил

## Подключение из приложения

### Backend

Переменные окружения в `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<ваш пароль>
DB_NAME=azs_pult
```

### Frontend

Переменные окружения в `.env.local`:
```
VITE_API_URL=http://localhost:3001/api
```

## Восстановление БД

Если нужно сбросить БД и начать заново:

```bash
# Удалить БД
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS azs_pult;"

# Создать новую
psql -h localhost -U postgres -c "CREATE DATABASE azs_pult;"

# Загрузить схему
psql -h localhost -U postgres -d azs_pult -f _data/schema.sql

# Загрузить данные
python backend/import_data.py
```

## Размер БД

После полного импорта размер БД составляет ~50-100 МБ:
- Таблицы: ~40 МБ
- Индексы: ~10-20 МБ
- Логи и история: ~5-10 МБ

## Контакты и поддержка

- **БД**: PostgreSQL 15
- **API**: Express.js (Node.js)
- **Фронтенд**: Vue 3 + Vite
- **Версия**: 2.1.0

---

**Последнее обновление**: 08.10.2026
