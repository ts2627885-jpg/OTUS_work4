# АЗС-Пульт v2.1 - Анализ проекта и БД

## Описание системы

**АЗС-Пульт v2.1** - полнофункциональная система управления ценовой политикой для сетей автозаправочных станций (АЗС). Система поддерживает:
- Управление станциями и типами топлива
- Мониторинг и управление ценами
- Анализ конкурентных цен
- AI-рекомендации по оптимизации цен
- Учет метеоданных и трафика
- Импорт данных через CSV
- Ролевой доступ и управление правами

---

## Архитектура

### Frontend (Vue 3 + Vite)
- **Порт**: 3000
- **Стек**: Vue 3, Pinia (state management), Vue Router, Axios, Element Plus
- **Компоненты**: 
  - LoginView - аутентификация
  - DashboardView - главная панель
  - AzsListView / AzsDetailView - управление АЗС
  - RecommendationsView - ценовые рекомендации
  - DataImportView - импорт данных
  - AdminView - администрирование

### Backend (Express + TypeScript)
- **Порт**: 3001
- **Стек**: Express, PostgreSQL, JWT, TypeScript
- **Слои**:
  - Controllers (API endpoints)
  - Services (business logic)
  - Repositories (data access)
  - Middleware (auth, validation, error handling)

### База данных
- **СУБД**: PostgreSQL 15
- **Хост**: localhost:5432
- **Учетные данные**: postgres / <пароль из DB_PASSWORD в backend/.env>
- **БД**: azs_pult

---

## Структура БД

### Таблицы

#### 1. **users** - Пользователи системы
```
id UUID PRIMARY KEY
username VARCHAR(255) UNIQUE NOT NULL
email VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
role VARCHAR(50) NOT NULL (admin, manager, analyst, viewer)
permissions TEXT[] NOT NULL
is_active BOOLEAN DEFAULT true
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 2. **azs** - Автозаправочные станции
```
id UUID PRIMARY KEY
name VARCHAR(255) NOT NULL
address TEXT NOT NULL
city VARCHAR(255) NOT NULL
region VARCHAR(255) NOT NULL
fuel_types TEXT[] NOT NULL (A95, A98, DT, LPG, etc)
manager VARCHAR(255)
status VARCHAR(50) (active, inactive, maintenance)
latitude DECIMAL(10,8)
longitude DECIMAL(11,8)
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 3. **prices** - Цены на топливо
```
id UUID PRIMARY KEY
azs_id UUID NOT NULL (FK -> azs)
fuel_type VARCHAR(50) NOT NULL
price DECIMAL(10,2) NOT NULL
trend VARCHAR(50) (up, down, stable)
updated_at TIMESTAMP
previous_price DECIMAL(10,2)
```

#### 4. **price_history** - История цен (аудит)
```
id UUID PRIMARY KEY
azs_id UUID NOT NULL (FK -> azs)
fuel_type VARCHAR(50) NOT NULL
price_from DECIMAL(10,2) NOT NULL
price_to DECIMAL(10,2) NOT NULL
changed_by UUID (FK -> users)
changed_at TIMESTAMP
reason VARCHAR(255)
```

#### 5. **recommendations** - Ценовые рекомендации
```
id UUID PRIMARY KEY
azs_id UUID NOT NULL (FK -> azs)
type VARCHAR(50) (price_increase, price_decrease, hold)
fuel_type VARCHAR(50) NOT NULL
current_price DECIMAL(10,2) NOT NULL
recommended_price DECIMAL(10,2) NOT NULL
reason TEXT
confidence DECIMAL(5,2) (0-100%)
estimated_revenue DECIMAL(12,2)
status VARCHAR(50) (active, completed, rejected)
created_at TIMESTAMP
completed_at TIMESTAMP
```

#### 6. **sales_data** - Данные о продажах
```
id UUID PRIMARY KEY
azs_id UUID NOT NULL (FK -> azs)
fuel_type VARCHAR(50) NOT NULL
volume DECIMAL(10,2) NOT NULL (литры)
revenue DECIMAL(12,2) NOT NULL (рубли)
date_recorded DATE NOT NULL
```

#### 7. **weather_data** - Метеоданные
```
id UUID PRIMARY KEY
azs_id UUID NOT NULL (FK -> azs)
temperature DECIMAL(5,2)
humidity DECIMAL(5,2)
wind_speed DECIMAL(5,2)
conditions VARCHAR(100)
date_recorded TIMESTAMP
```

#### 8. **competitor_prices** - Цены конкурентов
```
id UUID PRIMARY KEY
azs_id UUID NOT NULL (FK -> azs)
competitor_name VARCHAR(255)
fuel_type VARCHAR(50)
price DECIMAL(10,2)
distance_km DECIMAL(6,2)
last_updated TIMESTAMP
```

#### 9. **audit_logs** - Логи действий
```
id UUID PRIMARY KEY
user_id UUID (FK -> users)
action VARCHAR(255) NOT NULL
entity_type VARCHAR(100)
entity_id UUID
changes TEXT (JSON)
ip_address VARCHAR(45)
created_at TIMESTAMP
```

#### 10. **import_history** - История импорта данных
```
id UUID PRIMARY KEY
file_name VARCHAR(255)
imported_by UUID (FK -> users)
import_type VARCHAR(50) (prices, sales, weather)
record_count INT
status VARCHAR(50) (completed, failed, partial)
error_message TEXT
imported_at TIMESTAMP
```

---

## Индексы

```sql
CREATE INDEX idx_prices_azs_id ON prices(azs_id);
CREATE INDEX idx_prices_fuel_type ON prices(fuel_type);
CREATE INDEX idx_recommendations_azs_id ON recommendations(azs_id);
CREATE INDEX idx_sales_azs_id ON sales_data(azs_id);
CREATE INDEX idx_sales_date ON sales_data(date_recorded);
CREATE INDEX idx_weather_azs_id ON weather_data(azs_id);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_users_username ON users(username);
```

---

## Роли и права доступа

### Admin (администратор)
- Управление всеми АЗС
- Управление пользователями
- Просмотр всех отчетов и аналитики
- Управление системными настройками

### Manager (менеджер)
- Управление АЗС
- Установка цен
- Просмотр рекомендаций
- Импорт данных

### Analyst (аналитик)
- Просмотр данных и аналитики
- Генерация рекомендаций
- Просмотр истории цен

### Viewer (просмотр)
- Только чтение данных
- Просмотр отчетов

---

## Типы данных в системе

### Виды топлива
- A95 - Бензин АИ-95
- A98 - Бензин АИ-98
- DT - Дизельное топливо
- LPG - Сжиженный газ

### Статусы
- **Цены**: active, inactive, suspended
- **Рекомендации**: active, pending, completed, rejected
- **АЗС**: active, inactive, maintenance
- **Импорт**: completed, failed, partial

---

## Инструменты для работы с БД

1. **PostgreSQL CLI**
   ```bash
   psql -h localhost -U postgres -d azs_pult
   ```

2. **pgAdmin** (веб-интерфейс)
   - Стандартный порт: 5050

3. **DBeaver** (десктопный клиент)
   - Поддержка PostgreSQL
   - Визуальное редактирование

---

## Запросы для аналитики

### Топ АЗС по выручке
```sql
SELECT a.name, SUM(s.revenue) as total_revenue
FROM azs a
JOIN sales_data s ON a.id = s.azs_id
GROUP BY a.id
ORDER BY total_revenue DESC
LIMIT 10;
```

### Тренды цен по АЗС
```sql
SELECT azs_id, fuel_type, 
  price, previous_price,
  ROUND(((price - previous_price) / previous_price * 100)::numeric, 2) as change_percent
FROM prices
ORDER BY change_percent DESC;
```

### Эффективность рекомендаций
```sql
SELECT type, COUNT(*) as count, 
  ROUND(AVG(confidence)::numeric, 2) as avg_confidence
FROM recommendations
WHERE status = 'completed'
GROUP BY type;
```

---

## Последующие улучшения

1. **Добавить кэширование** - Redis для кэша цен
2. **Добавить очередь задач** - Bull/RabbitMQ для импорта
3. **Добавить WebSocket** - Реал-тайм обновления цен
4. **Добавить аналитику** - Elasticsearch для поиска
5. **Добавить мониторинг** - Prometheus/Grafana

---

## Контакты и поддержка

- **Разработка**: Backend (Express), Frontend (Vue 3)
- **ДБ**: PostgreSQL 15
- **API Documentation**: Swagger/OpenAPI
- **Версия**: 2.1.0
