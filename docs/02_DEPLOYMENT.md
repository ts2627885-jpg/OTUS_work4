# АЗС-Пульт: развёртывание

Состояние на 13.10.2026. Команды проверены на Windows 10 с Node.js 24, PostgreSQL 18.6 (локально) и Supabase (PostgreSQL 17.6).

## 0. Что понадобится

- Node.js 20 или новее, npm.
- Клиент PostgreSQL той же версии, что и сервер (для `pg_dump` и `pg_restore`). Путь к `pg_dump` задаётся `PG_DUMP_PATH`.
- Для self-hosted варианта: Docker Desktop или Docker Engine.
- Для Supabase: проект Supabase и строка подключения Session pooler (порт 5432).

Пароли и строки подключения храните в переменных окружения или в менеджере паролей. В файлы репозитория и в чат их не записывайте.

## 1. Структура

```
azs-pult-fullstack/
  backend/     Express + TypeScript (порт 3001)
  frontend/    Vue 3 + Vite (dev-порт из vite.config.js, сейчас 3000; в проекте используется 3002)
  db/          Dockerfile и docker-compose для self-hosted PostgreSQL 18
  scripts/     проверки API, анализ логов, проверка доступности
  docs/        документация
  _data/       исходные CSV и схема пайплайна (_BD/pipeline)
```

## 2. База данных

Выберите один из двух вариантов.

### Вариант A. Self-hosted (Docker)

1. Создайте `db/.env` по образцу `db/.env.example`: суперпользователь, имя базы, пароль роли приложения `APP_DB_USER` / `APP_DB_PASSWORD`, адрес публикации порта (`DB_BIND=127.0.0.1` по умолчанию).
2. Запустите контейнер из папки `db/`:
   ```
   docker compose --env-file .env up -d --build
   ```
   При первом запуске пустого тома скрипт `initdb/01-app-role.sh` создаёт роль приложения без суперпользователя и без `BYPASSRLS`.
3. Накатите схему из папки `backend`. Раннер берёт параметры из `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (для суперпользователя контейнера — `postgres` и его пароль из `db/.env`):
   ```
   npm run migrate
   ```
   Миграции 001–016 применяются по порядку, учёт — в `schema_migrations`.
4. Загрузите исходные данные. Пайплайн аналитики: `_data/_BD/pipeline/run_pipeline.sh` (нужен bash, `PGPASSWORD` и `PG_DUMP`). Либо восстановите дамп.

### Вариант B. Supabase

1. В дашборде Supabase: **Connect → Session pooler**, порт 5432. Строка вида `postgresql://postgres.<ref>:<пароль>@aws-1-<регион>.pooler.supabase.com:5432/postgres`. Transaction pooler (6543) не подходит: приложение использует настройки на уровне сессии.
2. Задайте строку в переменной окружения пользователя `SUPABASE_DB_URL`. Раннер миграций берёт параметры из неё (см. пример в разделе 4).
3. Накатите миграции:
   ```
   npm run migrate
   ```
   Миграция 009 выдаёт права роли приложения на схему `azs`, если она уже существует. Для чистой базы выполните миграции, затем загрузите данные `azs`, затем повторно выполните блок прав из миграции 009 (или 016 для последовательностей).
4. Создайте роль приложения. Выполните SQL (пароль задайте сами, храните в менеджере паролей):
   ```sql
   CREATE ROLE azs_app LOGIN PASSWORD '<пароль>' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
   GRANT USAGE ON SCHEMA public TO azs_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO azs_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO azs_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO azs_app;
   ```
   Имя пользователя для подключения через pooler: `azs_app.<ref>`.
5. Роль API Supabase (`anon`, `authenticated`) не должна видеть данные. Миграция 011 отзывает права; проверьте, что `has_table_privilege('anon', 'public.users', 'SELECT')` возвращает `false`.

## 3. Бэкенд

1. Установка и проверка:
   ```
   cd backend
   npm install
   npm run type-check
   ```
2. Файл `backend/.env` (образец — `backend/.env.example`). Обязательные переменные:

| Переменная | Значение |
|---|---|
| `PORT` | порт API, по умолчанию 3001 |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | адрес базы |
| `DB_USER`, `DB_PASSWORD` | роль приложения (`azs_app`), пароль в переменных окружения |
| `JWT_SECRET` | не короче 32 символов, обязательна (без значения по умолчанию) |
| `FRONTEND_URL` | адреса фронтенда через запятую (CORS), например `https://pult.example.ru` |
| `BACKUP_DB_USER`, `BACKUP_DB_PASSWORD` | роль резервных копий с обходом RLS (self-hosted: `postgres`; Supabase: `postgres.<ref>`) |
| `PG_DUMP_PATH` | путь к `pg_dump` той же версии, что сервер |

Необязательные:

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `DB_CONNECT_TIMEOUT` | 10000 мс | ожидание соединения с базой (для Supabase стоит 20000) |
| `DB_POOL_MAX` | 20 | максимум соединений пула |
| `DB_POOL_IDLE_TIMEOUT` | 600000 мс | время простоя соединения |
| `LOG_TO_DB` | false | писать предупреждения и ошибки в `app_logs` |
| `LOG_DIR` | `backend/logs` | папка файловых логов |
| `LOG_RETENTION_DAYS` | 90 | хранение файловых логов |
| `KEEP_BACKUPS` | 10 | сколько резервных копий хранить |
| `JWT_EXPIRES_IN` | 24h | срок действия токена |

3. Режим разработки: `npm run dev` (порт из `PORT`, по умолчанию 3001).
4. Продакшн-сборка и запуск:
   ```
   npm run build
   npm start
   ```
   `build` компилирует TypeScript и переписывает алиасы путей (`tsc-alias`), после этого `npm start` (`node dist/server.js`) работает без дополнительных флагов. Проверено: `GET /api/health` отвечает 200.

**Не используйте `backend/start.js`.** Это старый мок-сервер с секретом по умолчанию. Для контейнера есть `backend/Dockerfile` (раздел 3a).

## 3a. Docker-образ бэкенда

Сборка из папки `azs-pult-fullstack` (контекст нужен для `_data/_BD/pipeline/sync_public.sql`):
```
docker build -f backend/Dockerfile -t azs-pult-backend:latest .
# для self-hosted базы PostgreSQL 18 (клиент pg_dump той же версии):
docker build -f backend/Dockerfile --build-arg PG_CLIENT=postgresql18-client -t azs-pult-backend:latest .
```

Запуск: секреты передаются файлом переменных, который не попадает в образ (`.dockerignore` исключает `.env`):
```
docker run -d --name backend --network <сеть> --env-file backend.env azs-pult-backend:latest
```
`backend.env` содержит `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `FRONTEND_URL`, `BACKUP_DB_USER`, `BACKUP_DB_PASSWORD`, `DB_CONNECT_TIMEOUT`. Внутри контейнера приложение слушает 3001. Адрес базы на хосте Docker Desktop: `host.docker.internal`.

Проверено: образ собирается; контейнер на тестовой базе отвечает `/api/health` 200; все 110 проверок `scripts/api-test.mjs` проходят против контейнера; `pg_dump` в образе версии 17.11 (для Supabase).

Миграции из контейнера. Нужен владелец базы (`postgres`), не роль приложения: роль `azs_app` миграции не выполнит (`permission denied to create database`). Файл `migrate.env` содержит `DB_HOST`, `DB_PORT`, `DB_USER=postgres`, `DB_PASSWORD`, `DB_NAME`:
```
docker run --rm --env-file migrate.env azs-pult-backend:latest node dist/database/migrate.js
```
Проверено: на базе с уже применёнными миграциями вывод «Новых миграций нет».

## 4. Фронтенд

1. Файл `frontend/.env.local`:
   ```
   VITE_API_URL=http://localhost:3001/api
   ```
   Для продакшна, когда фронтенд и API на одном домене через nginx, используйте `VITE_API_URL=/api`.
2. Режимы:
   - разработка: `npm run dev` (Vite; прокси `/api` на бэкенд);
   - без бэкенда, на моках: `npm run dev:mock` (переменная `VITE_USE_MOCKS=true`);
   - продакшн-сборка: `npm run build`, готовые файлы в `frontend/dist`.
3. Раздача через nginx (файл `nginx.conf` в корне `azs-pult-fullstack`):
   - в `server_name` замените `example.ru` на свой домен (в двух блоках: порт 80 и порт 443);
   - положите сертификат домена (`fullchain.pem` и `privkey.pem`, например Let's Encrypt) в папку, которая монтируется в `/etc/nginx/certs`;
   - контейнеры nginx и бэкенд должны быть в одной сети Docker: бэкенд доступен по имени `backend` на порту 3001 (это `upstream backend` в конфиге);
   - фронтенд собирается с `VITE_API_URL=/api` (см. пункт 2);
   - запуск из папки `azs-pult-fullstack`:
     ```
     docker run -d --name azs-nginx --network <сеть> -p 80:80 -p 443:443 \
       -v "$PWD/nginx.conf:/etc/nginx/nginx.conf:ro" \
       -v "$PWD/frontend/dist:/usr/share/nginx/html:ro" \
       -v /путь/к/certs:/etc/nginx/certs:ro nginx:alpine
     ```
   - Проверено на тестовом стенде с самоподписанным сертификатом (порты 18080 и 18443): статика и маршруты приложения открываются, `/api` проксируется на бэкенд, вход работает, заголовки безопасности и редирект с HTTP есть, при всплеске попыток входа (больше 10 в минуту) nginx отвечает `503`.
   - Домен и настоящий сертификат на проде не проверялись: стенда с доменом у меня нет.

## 5. Проверка после развёртывания

```
# бэкенд жив и подключён к базе
curl http://localhost:3001/api/health

# вход (подставьте свои учётные данные)
curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"<пароль>"}'

# все эндпоинты по ролям и обработка ошибок (нужны пароли тестовых учёток в переменных окружения)
node scripts/api-test.mjs
```

Проверка записей (только тестовая база, на `localhost:3005`): `node scripts/api-write-test.mjs`.

## 6. Первый администратор

Миграции не создают пользователей. Если таблица `users` пуста, создайте администратора SQL-запросом, подставив хеш bcrypt, который выдаст бэкенд (`bcryptjs`, 12 раундов, как в `auth.service.ts`):
```
cd backend
node -e "require('bcryptjs').hash('<пароль>', 12).then(h => console.log(h))"
```
```sql
INSERT INTO users (username, email, password_hash, role, is_active)
VALUES ('admin', 'admin@example.ru', '<хеш>', 'admin', true);
```

Проверено на чистой тестовой базе: миграции 001–017 применены, администратор добавлен командой и SQL выше, вход `admin` возвращает роль `admin`, профиль, станции, пользователи и настройки отвечают 200.

Что нужно знать:
- Права роли приложения на таблицы выдаёт миграция 017 (в каждой базе отдельно). Без неё вход падает с `permission denied for table users`.
- Дашборд (`/api/dashboard`) и правила (`/api/analysis/rules`) на чистой базе отвечают 500 (`relation "azs.fuel_daily" does not exist`): данные аналитики появляются после загрузки пайплайном или CSV. Это ожидаемо.

## 7. Обслуживание

- **Резервные копии.** `POST /api/admin/backup` (admin). Копии в `backend/backups`, хранятся последние `KEEP_BACKUPS`. Копия делается от `BACKUP_DB_USER`: роль приложения без обхода RLS сохранила бы пустые таблицы станций.
- **Журналы.** Файлы: `backend/logs/app-ГГГГ-ММ-ДД.log`. Сводка: `node scripts/analyze-logs.mjs --hours=24`. В базе (при `LOG_TO_DB=true`): таблица `app_logs`, смотреть через SQL-редактор Supabase или `psql`.
- **Проверка доступности.** `scripts/db-health-check.ps1`, регистрация задания Планировщика: `scripts/register-health-check.ps1` (каждые 5 минут, перезапуск бэкенда при падении).
- **Миграции.** Каждая новая миграция — отдельный файл с номером. Перед применением на боевой базе сделайте дамп: `pg_dump -Fc`.

## 8. Частые проблемы

| Симптом | Причина и решение |
|---|---|
| `Cannot find module '@config/...'` при запуске `dist` | собрано без `tsc-alias`; выполните `npm run build` |
| `JWT_SECRET не задан или короче 32 символов` | задайте `JWT_SECRET` в `.env` |
| 500 на входе, в журнале «Connection terminated due to connection timeout» | пулер базы не отвечает; поднимите `DB_CONNECT_TIMEOUT` или проверьте состояние проекта |
| `permission denied for schema azs` | роли приложения не выданы права на `azs`; см. миграцию 009 (и 016 для последовательностей) |
| `pg_dump: ... row-level security` в резервной копии | задайте `BACKUP_DB_USER` с обходом RLS |
| `Login failed` без подробностей в браузере | проверьте `FRONTEND_URL` (CORS) и адрес в `VITE_API_URL` |
