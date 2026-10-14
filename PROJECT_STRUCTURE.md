# АЗС-Пульт v2.1 - Структура проекта

Описание репозитория: что где лежит и за что отвечает. Установка и запуск — в [SETUP.md](SETUP.md), обзор — в [README.md](README.md).

## 📂 Дерево репозитория

```
azs-pult-fullstack/
├─ backend/                         Express + TypeScript API (порт 3001)
│  ├─ src/
│  │  ├─ index.ts                   точка входа (экспорт createApp)
│  │  ├─ server.ts                  сборка Express-приложения, подключение маршрутов
│  │  ├─ config/
│  │  │  ├─ database.ts             пул PostgreSQL, переменные DB_*
│  │  │  └─ request-context.ts      контекст запроса (пользователь, БД)
│  │  ├─ controllers/
│  │  │  └─ auth.controller.ts      вход, регистрация, выход, обновление токена
│  │  ├─ routes/                    маршруты по разделам
│  │  │  ├─ stations.routes.ts      станции, данные станции, проверка станций
│  │  │  ├─ dashboard.routes.ts     /api/dashboard
│  │  │  ├─ analytics.routes.ts     /api/analytics/:tab
│  │  │  ├─ recommendations.routes.ts
│  │  │  ├─ import.routes.ts        загрузка CSV, история импорта, резервные копии
│  │  │  └─ admin.routes.ts         пользователи, настройки, логи, пробный план цен
│  │  ├─ services/                  бизнес-логика
│  │  │  ├─ auth.service.ts         JWT, bcryptjs
│  │  │  ├─ access.service.ts       доступ пользователей к станциям
│  │  │  ├─ rules.service.ts        правила рекомендаций
│  │  │  ├─ rules-extra.service.ts  дополнительные правила
│  │  │  ├─ elasticity.service.ts   эластичность спроса
│  │  │  ├─ recommendations.service.ts
│  │  │  ├─ analytics.service.ts
│  │  │  ├─ import.service.ts       разбор и загрузка CSV
│  │  │  ├─ public-sync.service.ts  синхронизация таблиц приложения (public)
│  │  │  ├─ price-test.service.ts   пробный план цен
│  │  │  ├─ settings.service.ts     настройки приложения
│  │  │  └─ backup.service.ts       резервные копии БД
│  │  ├─ repositories/
│  │  │  └─ user.repository.ts      доступ к таблице users
│  │  ├─ middleware/
│  │  │  ├─ auth.middleware.ts      проверка JWT
│  │  │  ├─ rbac.middleware.ts      проверка прав
│  │  │  ├─ roles.middleware.ts     проверка ролей
│  │  │  ├─ db-context.middleware.ts
│  │  │  ├─ requestLogger.middleware.ts   журнал запросов, healthCheck
│  │  │  └─ errorHandler.middleware.ts
│  │  ├─ models/                    типы: Azs, Price, Recommendation, User
│  │  ├─ mocks/                     заглушки auth и данных
│  │  ├─ utils/                     logger, errors, uuid, validators, db-log-sink
│  │  ├─ scripts/
│  │  │  └─ generate-recommendations.ts   npm run recommendations:generate
│  │  ├─ tests/api-test.ts          ручная проверка API
│  │  └─ database/
│  │     ├─ migrate.ts              применение миграций (npm run migrate)
│  │     ├─ migrations/             SQL-миграции 001–017 (по порядку имён)
│  │     ├─ init.sql, add-is-active.sql, add-column.ts   старые скрипты (legacy)
│  │     ├─ legacy/, pending/       архив и незавершённые изменения
│  │     ├─ import-data-content.ts, check-users.ts, update-passwords.ts, test-password.ts
│  │     └─ …
│  ├─ tests/
│  │  ├─ unit/                      Jest unit-тесты (npm run test:unit)
│  │  └─ integration/               тесты с реальной БД (npm run test:integration)
│  ├─ seed_users.py                 создание тестовых пользователей (читает DB_PASSWORD)
│  ├─ import_data.py                импорт CSV (старый скрипт)
│  ├─ load_*.py, import_*.py        отдельные скрипты загрузки (часть дублирует друг друга)
│  ├─ .env.example                  шаблон переменных окружения
│  ├─ package.json, tsconfig.json, jest.config.js
│  ├─ Dockerfile
│  └─ README.md, DEVELOPER_GUIDE.md, IMPLEMENTATION_STATUS.md, SESSION_SUMMARY.md
│
├─ frontend/                        Vue 3 + Vite (порт 3000)
│  ├─ src/
│  │  ├─ main.js                    точка входа
│  │  ├─ App.vue                    корневой компонент
│  │  ├─ router/index.js            маршруты и защита по ролям
│  │  ├─ stores/auth.js             Pinia: вход, роль, токен
│  │  ├─ api/                       axios-клиенты
│  │  │  ├─ client.js               базовый экземпляр axios, заголовок Authorization, mock-режим
│  │  │  ├─ auth.js, azs.js, dashboard.js, analytics.js
│  │  │  ├─ recommendations.js, import.js, admin.js
│  │  ├─ composables/               useStations, useRecommendations, useImport, useRequest
│  │  ├─ views/                     экраны
│  │  │  ├─ LoginView.vue           /login
│  │  │  ├─ RegisterView.vue        /register
│  │  │  ├─ DashboardView.vue       /
│  │  │  ├─ AzsListView.vue         /azs
│  │  │  ├─ AzsDetailView.vue       /azs/:id
│  │  │  ├─ DataView.vue            /data
│  │  │  ├─ AnalyticsView.vue       /analytics
│  │  │  ├─ RecommendationsView.vue /recommendations
│  │  │  ├─ DataImportView.vue      /import
│  │  │  ├─ AdminView.vue           /admin
│  │  │  └─ NotFoundView.vue        любой другой путь
│  │  ├─ components/
│  │  │  ├─ layout/                 AppHeader, AppSidebar, LogoMark, SidebarIcon
│  │  │  ├─ charts/SeriesChart.vue  графики
│  │  │  └─ common/                 StateMessage, HintIcon
│  │  ├─ mocks/                     мок-адаптер и fixtures/responses.json (режим dev:mock)
│  │  ├─ utils/tableLabels.js       подписи таблиц для карточек на телефоне
│  │  ├─ styles/                    tokens.css, responsive.css
│  │  └─ __tests__/                 Vitest-тесты (экраны, store, мок-адаптер)
│  ├─ scripts/refresh-mock-fixtures.mjs   обновление фикстур по работающему backend
│  ├─ public/
│  ├─ .env.example, .env.local, .env.mock
│  ├─ vite.config.js, vitest.config.js, package.json
│  └─ Dockerfile
│
├─ tests/load/                      нагрузочные сценарии
├─ api/index.js                     serverless-обёртка Express для Vercel (/api/* → backend/dist)
├─ vercel.json                      сборка и маршрутизация Vercel
│
├─ _data/                           схема БД и исходные данные
│  ├─ schema.sql                    полная схема public (эквивалент миграции 001)
│  ├─ README.md                     описание данных и аналитические запросы
│  ├─ DATA_DESCRIPTION.md
│  ├─ backup_20261008_232028/       пример папки с 7 CSV (01.06.2025 – 21.09.2026)
│  └─ _BD/pipeline/                 пайплайн пересборки схемы azs из CSV
│     ├─ run_pipeline.sh            точка входа (очистка, схема, загрузка, правила, контроль)
│     ├─ schema.sql                 DDL схемы azs (12 таблиц)
│     ├─ transform.sql, post.sql, sync_public.sql
│     ├─ load_all.py, load_competitor_prices.py, clean_promotions.py, gen_load.py
│     ├─ azs_README.md              описание пайплайна
│     ├─ data/                      исходные CSV
│     ├─ backups/, logs/, out/      резервные копии, журналы, результаты
│
├─ db/                              локальная БД в Docker
│  ├─ docker-compose.yml, Dockerfile
│  └─ initdb/01-app-role.sh         создание роли приложения без BYPASSRLS
│
├─ .github/workflows/
│  ├─ ci.yml                        lint, типы, тесты, сборка (backend и frontend)
│  └─ deploy.yml                    деплой на Vercel после успешного CI
│
├─ scripts/                         PowerShell и Node-утилиты
│  ├─ schedule-recommendations.ps1  расписание пересчёта рекомендаций (Windows)
│  ├─ db-health-check.ps1, register-health-check.ps1
│  ├─ api-test.mjs, api-crud-check.mjs, api-write-test.mjs, analyze-logs.mjs
│  └─ QUICKSTART.ps1, SETUP_COMPLETE.ps1, LOAD_ALL_DATA.ps1 и др. (старые сценарии)
│
├─ docs/                            журнал работы, формулы правил, матрица ошибок, промпты
├─ nginx/, nginx.conf               конфигурация reverse proxy (Docker)
├─ grafana/, prometheus.yml         мониторинг (Docker)
├─ docker-compose.yml               стек: postgres, redis, backend, frontend, nginx, pgadmin, мониторинг
├─ SETUP.md, PROJECT_STRUCTURE.md, README.md
├─ development_report.md, FINAL_STATUS.md, PROJECT_SUMMARY.md, DEPLOYMENT.md, INSTALL.md, ARCHITECTURE.md
└─ .agents/, .claude/, skills-lock.json   служебные файлы ассистента (не в git)
```

> Папка `_data/backup_20261008_232028/` и файлы в корне с отчётами (`FINAL_STATUS.md`, `SESSION_SUMMARY.md` и др.) — исторические. Актуальные сведения — в README и SETUP.

## 📋 Ключевые файлы

### Backend

| Файл | Назначение |
|---|---|
| `src/server.ts` | Express-приложение: helmet, CORS, JSON, журнал запросов, маршруты |
| `src/routes/*.ts` | Регистрация маршрутов с `authenticateToken` |
| `src/services/rules.service.ts` | Правила ценообразования и кэш результатов |
| `src/services/import.service.ts` | Разбор CSV и загрузка в `azs`/`public` |
| `src/services/public-sync.service.ts` | Синхронизация таблиц приложения из схемы `azs` |
| `src/database/migrate.ts` | Применение миграций, журнал `schema_migrations` с контрольной суммой |
| `src/middleware/auth.middleware.ts` | Проверка JWT на каждом запросе |
| `src/middleware/rbac.middleware.ts` | Проверка прав по роли (роль читается из БД) |

### Frontend

| Файл | Назначение |
|---|---|
| `src/router/index.js` | Маршруты и защита по авторизации и ролям |
| `src/stores/auth.js` | Pinia-хранилище входа и роли |
| `src/api/client.js` | axios: базовый адрес, токен, переключение mock-режима |
| `src/mocks/mockAdapter.js` | Подмена API в режиме `dev:mock` |
| `src/views/*.vue` | Экраны приложения |

### База данных

**Таблицы `public`** (создаются миграциями 001–017):
`users`, `azs`, `azs_access`, `prices`, `price_history`, `price_test_plan`, `sales_data`, `shop_sales`, `traffic_data`, `weather_data`, `competitor_prices`, `promotions`, `recommendations`, `import_history`, `audit_logs`, `login_logs`, `app_logs`, `app_settings`.

**Представления**: `user_names`, `v_azs_revenue_summary`, `v_price_trends`, `v_recommendations_stats`.

Служебная таблица `schema_migrations` ведёт `npm run migrate`.

**Схема `azs`** (аналитика, пересоздаётся пайплайном): `station`, `fuel_type`, `calendar`, `competitor`, `competitor_price`, `fuel_daily`, `shop_product`, `shop_sales_daily`, `station_daily`, `traffic_daily`, `weather_daily`, `promotion`.

## 🔑 Технологии

### Backend
- Express.js + TypeScript, пакет `pg` (без ORM, собственные репозитории)
- JWT (`jsonwebtoken`), bcryptjs, Joi, Helmet, CORS, Multer
- Jest, ESLint, ts-node/nodemon для разработки

### Frontend
- Vue 3 (Composition API), Vite, Vue Router, Pinia, Axios
- Element Plus, Chart.js (`vue-chartjs`)
- Vitest, Vue Test Utils, jsdom

### База данных
- PostgreSQL (локально или хостинг; Docker-образ — 15), миграции в `backend/src/database/migrations/`
- Роль приложения без суперпользователя и без `BYPASSRLS`, политики RLS на таблицах

## 🔐 Поток аутентификации

```
1. Пользователь открывает http://localhost:3000 → LoginView.vue
2. Frontend отправляет POST /api/auth/login (username, password)
3. Backend проверяет пароль через bcryptjs и выдаёт JWT
4. Frontend сохраняет токен и передаёт его в заголовке Authorization
5. auth.middleware проверяет токен на каждом запросе
6. rbac/roles проверяют роль пользователя по таблице users
7. Пользователь видит данные своего уровня доступа
```

## 🚀 Запуск

```bash
# Разработка
cd backend && npm run dev     # http://localhost:3001
cd frontend && npm run dev    # http://localhost:3000

# Сборка
cd backend && npm run build && npm start
cd frontend && npm run build && npm run preview
```

---

**Версия**: 2.1.0
**Последнее обновление**: 14.10.2026
