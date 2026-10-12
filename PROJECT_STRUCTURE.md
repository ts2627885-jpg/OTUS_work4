# АЗС-Пульт v2.1 - Структура проекта

## 📂 Организация папок и файлов

```
azs-pult-fullstack/
│
├─ backend/                          # Express.js + TypeScript API
│  ├─ src/
│  │  ├─ controllers/               # API endpoint handlers
│  │  │  ├─ authController.ts       # Вход, регистрация
│  │  │  ├─ azsController.ts        # Управление АЗС
│  │  │  ├─ pricesController.ts     # Управление ценами
│  │  │  ├─ recommendationsController.ts
│  │  │  └─ adminController.ts      # Администрирование
│  │  │
│  │  ├─ services/                  # Бизнес-логика
│  │  │  ├─ authService.ts          # Аутентификация, JWT
│  │  │  ├─ azsService.ts           # Логика работы с АЗС
│  │  │  ├─ pricesService.ts        # Логика цен
│  │  │  └─ recommendationService.ts# AI рекомендации
│  │  │
│  │  ├─ repositories/              # Доступ к данным (DAO)
│  │  │  ├─ userRepository.ts       # Операции с пользователями
│  │  │  ├─ azsRepository.ts
│  │  │  ├─ pricesRepository.ts
│  │  │  └─ recommendationsRepository.ts
│  │  │
│  │  ├─ middleware/                # Express middleware
│  │  │  ├─ authMiddleware.ts       # JWT verification
│  │  │  ├─ errorHandler.ts         # Error handling
│  │  │  ├─ validation.ts           # Request validation
│  │  │  └─ corsMiddleware.ts       # CORS headers
│  │  │
│  │  ├─ database/
│  │  │  ├─ connection.ts           # PostgreSQL connection
│  │  │  ├─ migrate.ts              # Migration runner
│  │  │  ├─ init.sql                # Initial schema (legacy)
│  │  │  ├─ add-column.ts           # Add is_active column
│  │  │  └─ update-passwords.ts     # Password hashing script
│  │  │
│  │  └─ server.ts                  # Main Express app
│  │
│  ├─ .env                          # Environment variables
│  ├─ .env.example                  # Template for .env
│  ├─ .gitignore
│  ├─ package.json                  # Dependencies: express, pg, bcryptjs, etc.
│  ├─ package-lock.json
│  ├─ tsconfig.json                 # TypeScript config with path aliases
│  ├─ nodemon.json                  # Dev server config
│  ├─ import_data.py                # CSV data import script
│  └─ README.md
│
├─ frontend/                         # Vue 3 + Vite + TypeScript
│  ├─ src/
│  │  ├─ components/                # Vue components
│  │  │  ├─ LoginForm.vue           # Login page
│  │  │  ├─ Navbar.vue              # Navigation bar
│  │  │  ├─ Sidebar.vue             # Side navigation
│  │  │  ├─ AzsCard.vue             # Station card
│  │  │  ├─ PriceEditor.vue         # Price management
│  │  │  ├─ RecommendationCard.vue  # Recommendation display
│  │  │  └─ ChartComponent.vue      # Analytics charts
│  │  │
│  │  ├─ stores/                    # Pinia state management
│  │  │  ├─ auth.js                 # Authentication store
│  │  │  ├─ azs.js                  # AZS store
│  │  │  ├─ prices.js               # Prices store
│  │  │  └─ analytics.js            # Analytics data store
│  │  │
│  │  ├─ api/                       # Axios API clients
│  │  │  ├─ client.js               # Base axios instance
│  │  │  ├─ auth.js                 # Auth API
│  │  │  ├─ azs.js                  # AZS API
│  │  │  ├─ prices.js               # Prices API
│  │  │  ├─ recommendations.js      # Recommendations API
│  │  │  ├─ admin.js                # Admin API
│  │  │  └─ analytics.js            # Analytics API
│  │  │
│  │  ├─ views/                     # Page components
│  │  │  ├─ LoginView.vue           # /login
│  │  │  ├─ DashboardView.vue       # /dashboard
│  │  │  ├─ AzsListView.vue         # /azs
│  │  │  ├─ AzsDetailView.vue       # /azs/:id
│  │  │  ├─ PricesView.vue          # /prices
│  │  │  ├─ RecommendationsView.vue # /recommendations
│  │  │  ├─ AnalyticsView.vue       # /analytics
│  │  │  ├─ DataImportView.vue      # /import
│  │  │  └─ AdminView.vue           # /admin
│  │  │
│  │  ├─ router/                    # Vue Router
│  │  │  └─ index.js                # Routes configuration
│  │  │
│  │  ├─ App.vue                    # Root component
│  │  ├─ main.js                    # Entry point
│  │  └─ style.css                  # Global styles
│  │
│  ├─ public/                       # Static assets
│  │  └─ favicon.ico
│  │
│  ├─ .env.local                    # Environment variables
│  ├─ .env.example
│  ├─ .gitignore
│  ├─ vite.config.js                # Vite build config
│  ├─ package.json                  # Dependencies: vue, pinia, axios, etc.
│  ├─ package-lock.json
│  ├─ index.html                    # HTML entry point
│  └─ README.md
│
├─ _data/                           # Database and data files
│  ├─ schema.sql                    # 🔑 Complete PostgreSQL schema
│  │                                # ├─ 10 tables with proper constraints
│  │                                # ├─ Indexes for performance
│  │                                # ├─ Audit functions and triggers
│  │                                # └─ Analytics views
│  │
│  ├─ README.md                     # 📖 Data documentation
│  │                                # ├─ Quick start guide
│  │                                # ├─ File descriptions
│  │                                # ├─ SQL queries for analytics
│  │                                # └─ Database connection info
│  │
│  ├─ CSV Data Files (Real Dataset - 13 months)
│  │  ├─ stations.csv               # 5 АЗС stations with infrastructure
│  │  ├─ prices.csv                 # 5000+ daily fuel prices & sales (semicolon-delimited)
│  │  ├─ weather_data.csv           # 1800+ weather records
│  │  ├─ traffic_data.csv           # Traffic flow data
│  │  ├─ competitor_prices.csv      # 50000+ competitor price monitoring
│  │  ├─ promotions.csv             # 100+ promotion records
│  │  └─ shop_sales.csv             # Store and shop sales data
│  │
│  └─ DATA_DESCRIPTION.md           # Detailed data structure docs
│
├─ SETUP.md                         # 🚀 Complete setup and run guide
├─ PROJECT_STRUCTURE.md             # This file
├─ README.md                        # Project overview
└─ .gitignore
```

## 📋 Файлы и их назначение

### Backend (_src_ папка)

| Файл | Назначение |
|------|-----------|
| **authController.ts** | POST /auth/login, /auth/register - вход и регистрация |
| **authService.ts** | Логика JWT токенов, bcryptjs хеширование паролей |
| **userRepository.ts** | SELECT/INSERT/UPDATE/DELETE пользователей из БД |
| **authMiddleware.ts** | Проверка JWT токена в каждом запросе |
| **azsController.ts** | GET/POST/PUT/DELETE АЗС |
| **azsService.ts** | Бизнес-логика работы со станциями |
| **azsRepository.ts** | CRUD операции с таблицей azs |
| **pricesController.ts** | Endpoints для управления ценами |
| **pricesService.ts** | Логика обновления цен, история |
| **pricesRepository.ts** | Работа с таблицами prices, price_history |
| **recommendationService.ts** | Генерация AI рекомендаций |
| **recommendationsRepository.ts** | CRUD recommendations |
| **adminController.ts** | Endpoints для администрирования |
| **errorHandler.ts** | Обработка ошибок в едином формате |
| **validation.ts** | Валидация входных данных (schema validation) |
| **connection.ts** | Пул соединений PostgreSQL |
| **migrate.ts** | Инициализация схемы БД |
| **server.ts** | Express app, маршруты, middleware |

### Frontend (_src_ папка)

| Файл | Назначение |
|------|-----------|
| **auth.js** | Pinia store для authentication |
| **azs.js** | Pinia store для списка АЗС |
| **prices.js** | Pinia store для цен |
| **analytics.js** | Pinia store для аналитики |
| **api/client.js** | Базовая конфигурация axios (baseURL, auth header) |
| **api/auth.js** | API вызовы auth endpoints |
| **api/azs.js** | API вызовы для АЗС |
| **api/prices.js** | API вызовы для цен |
| **api/admin.js** | API вызовы для администрирования |
| **LoginForm.vue** | Форма входа с username/password |
| **Navbar.vue** | Верхняя навигация с профилем |
| **DashboardView.vue** | Главная панель с KPI |
| **AzsListView.vue** | Таблица со списком станций |
| **PricesView.vue** | Управление ценами в таблице |
| **RecommendationsView.vue** | Список рекомендаций по ценам |
| **AnalyticsView.vue** | Графики и аналитика |
| **router/index.js** | Vue Router с защитой от неавторизированных |

### База данных (_data папка)

| Файл | Размер | Описание |
|------|--------|---------|
| **schema.sql** | 9.2 КБ | Полная схема 10 таблиц + индексы + представления |
| **README.md** | - | Документация по данным и запросы |
| **stations.csv** | 1.9 КБ | 5 АЗС с инфраструктурой |
| **prices.csv** | 680 КБ | 5000+ записей (цены, объемы, даты) |
| **weather_data.csv** | 89 КБ | Погода за 13 месяцев |
| **competitor_prices.csv** | 12.3 МБ | Мониторинг конкурентов |
| **promotions.csv** | 19 КБ | Акции и спецпредложения |

## 🔑 Ключевые технологии

### Backend
- **Framework**: Express.js (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **Auth**: JWT (jsonwebtoken)
- **Passwords**: bcryptjs
- **ORM**: Custom repositories (no Sequelize/TypeORM for simplicity)
- **Validation**: Custom validators
- **Environment**: Nodemon + ts-node

### Frontend
- **Framework**: Vue 3 (Composition API)
- **Build**: Vite
- **State Management**: Pinia
- **HTTP Client**: Axios
- **Routing**: Vue Router
- **UI Components**: Element Plus
- **Styling**: Tailwind CSS (optional)

### Database
- **RDBMS**: PostgreSQL 15
- **Tables**: 10 (users, azs, prices, price_history, recommendations, sales_data, weather_data, competitor_prices, audit_logs, import_history)
- **Views**: 3 analytical views
- **Triggers**: auto-update updated_at timestamps
- **Indexes**: 20+ for performance

## 🔐 Данные потока

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Browser)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    HTTP/HTTPS (Port 3000)
                           │
        ┌──────────────────▼──────────────────┐
        │   Frontend (Vue 3 + Vite)          │
        │  - Components (UI)                 │
        │  - Pinia stores (State)            │
        │  - Axios client (HTTP)             │
        └──────────────────┬──────────────────┘
                           │
                    REST API (Port 3001)
                           │
        ┌──────────────────▼──────────────────┐
        │   Backend (Express + TypeScript)   │
        │  - Controllers (Routes)            │
        │  - Services (Logic)                │
        │  - Repositories (Data Access)      │
        │  - Middleware (Auth, Validation)   │
        └──────────────────┬──────────────────┘
                           │
                    TCP (Port 5432)
                           │
        ┌──────────────────▼──────────────────┐
        │   PostgreSQL 15                    │
        │  - Users table                     │
        │  - AZS table                       │
        │  - Prices table                    │
        │  - Recommendations table           │
        │  - Analytics views                 │
        │  - Audit logs                      │
        └────────────────────────────────────┘
```

## 🔄 Аутентификация Flow

```
1. User заходит на http://localhost:3000
2. Frontend показывает LoginForm.vue
3. User вводит username + password
4. Frontend отправляет POST /auth/login
5. Backend authController проверяет username в БД
6. Backend authService сравнивает пароль с bcrypt hash
7. Backend генерирует JWT токен
8. Frontend сохраняет токен в localStorage
9. Frontend отправляет токен в Authorization header
10. authMiddleware проверяет token на каждый запрос
11. User видит Dashboard с данными
```

## 📊 Аналитика и представления

### Встроенные SQL представления (Views)

```sql
v_azs_revenue_summary    -- Выручка по станциям
v_price_trends           -- Изменения цен
v_recommendations_stats  -- Статистика рекомендаций
```

Используются в:
- Analytics API endpoints
- AnalyticsView компоненте
- Dashboard KPI

## 🚀 Развертывание

### Development
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

### Production
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

## 📈 Производительность

### Оптимизации

1. **Индексы в БД**
   - По azs_id (все таблицы с данными)
   - По датам (временные ряды)
   - По типам топлива (поиск)
   - По статусам (фильтры)

2. **Кэширование** (будущее)
   - Redis для цен
   - HTTP cache headers

3. **Пагинация**
   - GET /api/azs?limit=50&offset=0
   - GET /api/prices?page=1&size=100

4. **Батчинг**
   - Множественные обновления цен за раз
   - Импорт CSV в одной транзакции

## 🔍 Отладка и логирование

### Backend логи
- Console.log в src/server.ts
- Database query logs (можно включить в PostgreSQL)
- Error stack traces в errorHandler.ts

### Frontend логи
- Browser Console (F12)
- Network tab для API запросов
- Pinia DevTools (vue-devtools)

### Database логи
```bash
psql -h localhost -U postgres -d azs_pult
\x on  -- expanded display
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

## 📚 Дальнейшие улучшения

### Short-term
- [ ] WebSocket для real-time цен
- [ ] Email уведомления
- [ ] CSV export функции
- [ ] Advanced filtering & search

### Medium-term
- [ ] Redis кэширование
- [ ] Message queue (Bull/RabbitMQ)
- [ ] Elasticsearch для поиска
- [ ] Multi-language поддержка

### Long-term
- [ ] Microservices архитектура
- [ ] ML рекомендации
- [ ] Mobile приложение
- [ ] Интеграция с ERP системами

---

**Версия**: 2.1.0  
**Последнее обновление**: 08.10.2026
