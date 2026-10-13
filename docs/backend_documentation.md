# АЗС-Пульт: документация бэкенда

Состояние на 13.10.2026, после применения миграции 017 на Supabase и настройки роли резервных копий. Документ собран из проверенных сведений. Подробности по каждому разделу — в файлах `01_ARCHITECTURE.md`, `02_DEPLOYMENT.md`, `API.md`, `04_EXAMPLES.md`.

---

## 1. Архитектура

### Состав

```
Браузер
  │  HTTPS /api (JSON, Bearer-токен)
  ▼
nginx (статика фронтенда + прокси /api)          nginx.conf
  ▼
Backend: Express 4 + TypeScript, порт 3001        backend/src/
  │  пул pg, роль приложения azs_app (без BYPASSRLS)
  ▼
PostgreSQL: Supabase (17) или self-hosted (18)
  • public — данные приложения (пользователи, станции, цены, рекомендации, журналы)
  • azs    — аналитика (продажи, трафик, погода, конкуренты), грузится пайплайном и импортом
```

### Слои бэкенда

| Слой | Папка | Назначение |
|---|---|---|
| Маршруты | `server.ts`, `routes/` | эндпоинты, middleware, старт |
| Контроллеры | `controllers/` | разбор запроса, ответ (аутентификация) |
| Сервисы | `services/` | правила, эластичность, аналитика, рекомендации, импорт, резервные копии, доступ, планы теста |
| Репозитории | `repositories/` | таблица пользователей |
| Middleware | `middleware/` | JWT, роли, контекст базы (RLS), обработчик ошибок |
| Конфигурация | `config/` | пул соединений, контекст запроса к базе |
| Утилиты | `utils/` | логгер, Joi-валидация, классы ошибок, запись логов в базу |

### Механизмы

- **Аутентификация.** Собственная, JWT. Вход — `POST /api/auth/login`. Пароли — bcrypt (12 раундов).
- **Роли.** `admin` — всё; `manager` — только назначенные станции (`azs_access`), изменение; `analyst`, `viewer` — только чтение. Проверки в коде и в базе.
- **RLS.** На каждый запрос `/api` берётся соединение, в котором задаются `app.role` и `app.user_id`. Политики (миграции 010, 012–014) ограничивают строки. Без контекста строк нет.
- **Ошибки.** Единый формат `{ success, error, code }`. Клиентские ошибки (400, 401, 403, 404, 409) с понятным текстом, серверные (500) — без деталей.
- **Журналы.** Файлы `logs/app-ГГГГ-ММ-ДД.log` (JSON, хранение 90 дней). При `LOG_TO_DB=true` предупреждения и ошибки — в таблицу `app_logs`.
- **Расчёты.** Правила и эластичность кэшируются по версии данных (количество строк и даты таблиц). Кэш сбрасывается после импорта и через 10 минут. Прогрев при старте.

### Поток данных

1. Импорт CSV (`POST /api/import/csv`): тип по заголовкам → запись в `azs` (upsert) → синхронизация `public` → пересчёт рекомендаций. Перед записью — резервная копия.
2. Правила (`GET /api/analysis/rules`) и пересчёт рекомендаций (`POST /api/recommendations/generate`) читают `azs` и пишут в `recommendations`.
3. Рекомендации закрываются вручную или при пересчёте (дедупликация по `dedupe_key`).

### Ограничения

- Пулер Supabase время от времени не отвечает дольше таймаута (`DB_CONNECT_TIMEOUT`, для Supabase 20 с). Тогда ответ 500 с записью в журнале. Наблюдалось 13.10: разовые таймауты при входе, при прогреве кэша при старте (повторы до трёх попыток) и при применении миграций (повтор проходил). Задержка одного простого запроса менялась от 1.6 с до более 2 минут.
- Холодный расчёт правил около 10 секунд; тёплый из кэша — около 0.6 секунды.
- Дашборд и правила требуют данных аналитики (схема `azs`); на пустой базе отвечают 500.

---

## 2. Развёртывание

### Что нужно

- Node.js 20+, npm. Клиент PostgreSQL той же версии, что сервер (для резервных копий).
- Для self-hosted: Docker. Для Supabase: проект и строка Session pooler (порт 5432).
- Секреты — только в переменных окружения или менеджере паролей.

### База

**Self-hosted (Docker, PostgreSQL 18):** `db/` — `docker compose --env-file .env up -d --build`. Скрипт `initdb` создаёт роль приложения `azs_app`.

**Supabase:** строка подключения Session pooler в переменной `SUPABASE_DB_URL`; роль приложения `azs_app` создана, права на `public` выдаёт миграция 017. Состояние боевой базы: применены миграции 001–017, резервная копия проверена (количество строк совпадает с базой). Роль резервных копий: `BACKUP_DB_USER` = `postgres.<ref>` (с обходом RLS), пароль в переменных окружения пользователя.

**Миграции** (владелец базы, не `azs_app`):
```
cd backend
npm run migrate
```
Миграции 001–017 по порядку, учёт в `schema_migrations`. Проверено на чистой базе: все применяются.

**Данные аналитики** — пайплайн `_data/_BD/pipeline/run_pipeline.sh` или импорт CSV через интерфейс.

### Бэкенд

Переменные (полный список — `02_DEPLOYMENT.md`):

| Переменная | Назначение |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | база; `DB_USER` — `azs_app` |
| `JWT_SECRET` | не короче 32 символов, обязательна |
| `FRONTEND_URL` | адреса фронтенда для CORS |
| `BACKUP_DB_USER`, `BACKUP_DB_PASSWORD` | роль резервных копий с обходом RLS |
| `PG_DUMP_PATH` | путь к `pg_dump` той же версии, что сервер |
| `DB_CONNECT_TIMEOUT` | таймаут подключения, мс (для Supabase 20000) |
| `LOG_TO_DB` | `true` — писать предупреждения и ошибки в `app_logs` |

Запуск без Docker:
```
npm run build      # tsc + tsc-alias
npm start          # node dist/server.js
```

Запуск в Docker:
```
docker build -f backend/Dockerfile -t azs-pult-backend:latest .
docker run -d --name backend --network <сеть> --env-file backend.env azs-pult-backend:latest
```
Проверено: образ собирается; контейнер на тестовой базе отвечает `/api/health` 200; все 110 проверок `api-test.mjs` проходят против контейнера; `pg_dump` в образе версии 17.11.
Для self-hosted базы PostgreSQL 18 добавьте `--build-arg PG_CLIENT=postgresql18-client`.

Миграции из контейнера (под владельцем):
```
docker run --rm --env-file migrate.env azs-pult-backend:latest node dist/database/migrate.js
```

### Фронтенд и nginx

Фронтенд: `VITE_API_URL=/api npm run build` в `frontend/`, результат — `frontend/dist`.
nginx: `nginx.conf` в корне. Заменить `example.ru` на домен, положить сертификат в `/etc/nginx/certs`, контейнеры в одной сети с бэкендом (имя `backend`, порт 3001). Проверено на тестовом стенде с самоподписанным сертификатом; домен и сертификат не проверялись.

### Первый администратор

```
cd backend
node -e "require('bcryptjs').hash('<пароль>', 12).then(h => console.log(h))"
```
```sql
INSERT INTO users (username, email, password_hash, role, is_active)
VALUES ('admin', 'admin@example.ru', '<хеш>', 'admin', true);
```
Проверено на чистой базе: вход работает, доступ к профилю, станциям, пользователям и настройкам есть.

### Обслуживание

- Резервные копии: `POST /api/admin/backup` (admin), хранятся `KEEP_BACKUPS` последних. Таймаут `pg_dump` 5 минут; при ошибке или таймауте неполный файл удаляется.
- Журналы: `node scripts/analyze-logs.mjs --hours=24`.
- Доступность: `scripts/db-health-check.ps1`, задание Планировщика — `scripts/register-health-check.ps1`.
- Перед любой миграцией на боевой базе — дамп `pg_dump -Fc`.

---

## 3. API: эндпоинты

База: `/api`. Все маршруты, кроме входа, регистрации и `/api/health`, требуют `Authorization: Bearer <токен>`.

| Метод и путь | Доступ | Назначение |
|---|---|---|
| `POST /auth/login` | все | вход, выдаёт JWT |
| `POST /auth/register` | все | регистрация (роль `viewer`) |
| `GET /auth/profile` | авторизованные | профиль текущего пользователя |
| `GET /health` | все | проверка доступности |
| `GET /azs` | все (manager — назначенные) | список станций |
| `GET /azs/:id` | доступ к станции | станция |
| `POST /azs` | admin | создать станцию |
| `PUT /azs/:id` | admin; manager — назначенная | изменить станцию |
| `DELETE /azs/:id` | admin | удалить (409, если есть данные) |
| `GET /azs/:id/sales`, `/traffic`, `/weather`, `/competitors` | доступ к станции | данные станции |
| `GET /prices` | все | текущие цены |
| `GET /dashboard` | все | сводка для главного экрана |
| `GET /analytics/:tab` | все | аналитика: prices, competitors, traffic, factors, volume, shop, promotions |
| `GET /analysis/rules` | все | правила расчёта (кэш) |
| `GET /recommendations` | все | список рекомендаций |
| `GET /recommendations/azs/:azsId` | доступ к станции | рекомендации станции |
| `POST /recommendations/generate` | admin | пересчёт |
| `POST /recommendations/:id/complete` | admin; manager — своя станция | закрыть |
| `GET /stations/check` | admin | сверка станций |
| `POST /import/csv` | admin, manager | загрузка CSV |
| `GET /import/history`, `/import/summary` | все | история и сводка импорта |
| `GET /import/backups` | admin, manager | список резервных копий |
| `GET /admin/users`, `POST /admin/users`, `PUT /admin/users/:id`, `DELETE /admin/users/:id` | admin | пользователи |
| `GET/PUT /admin/users/:id/azs` | admin | назначение станций |
| `GET/PUT /admin/settings`, `GET /admin/settings/history`, `/export`, `POST /admin/settings/import` | admin | настройки расчёта |
| `GET /admin/logs/audit`, `/admin/logs/login` | admin | журналы |
| `GET /admin/stats/overall` | все | общая статистика |
| `POST /admin/backup` | admin | резервная копия |
| `GET /admin/price-test`, `POST /admin/price-test/draft` | admin | планы теста цен |

Маршрут `/api/v1/…` обрабатывается так же, как `/api/…`.

---

## 4. Примеры запросов

Все примеры — в `04_EXAMPLES.md`. Ниже основные. `$TOKEN` — токен из входа.

Вход:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<пароль>"}'
# 200: {"success":true,"data":{"token":{"access_token":"eyJ...","token_type":"Bearer","expires_in":"24h"},"user":{...}}}
```

Станции:
```bash
curl http://localhost:3001/api/azs -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3001/api/azs -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"АЗС 130","fuelTypes":["A92","DT"]}'
```

Дашборд и рекомендации:
```bash
curl "http://localhost:3001/api/dashboard?days=28" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/recommendations?status=active" -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3001/api/recommendations/generate -H "Authorization: Bearer $TOKEN"
```

Импорт:
```bash
curl -X POST http://localhost:3001/api/import/csv -H "Authorization: Bearer $TOKEN" \
  -F "file=@_data/_BD/pipeline/data/weather_data.csv"
```

Ошибки:

| Ситуация | Статус | Ответ |
|---|---|---|
| нет токена | 401 | `{"success":false,"error":"Missing authorization token","code":"AUTHENTICATION_ERROR"}` |
| повторная регистрация | 409 | `{"success":false,"error":"Логин уже занят","code":"USERNAME_EXISTS"}` |
| станция без доступа (manager) | 404 | `{"success":false,"error":"Not found"}` |
| некорректный JSON | 400 | `{"success":false,"error":"Некорректный JSON в запросе","code":"BAD_REQUEST"}` |

---

## 5. Процесс разработки с AI

Бэкенд и связанная инфраструктура разрабатывались в диалоге с AI-ассистентом (Claude, в среде Claude Code). Человек ставил задачи, принимал решения о доступе к данным и выполнял действия, которые ассистент не мог выполнить сам.

Как устроен процесс:

- **Задача — проверка результата.** Каждое изменение проверялось: компиляцией (`npm run type-check`), тестами фронтенда (`vitest`), сборкой, запросами к работающему API, сравнением ответов до и после.
- **Тесты как контракт.** Для API написаны скрипты: `api-test.mjs` проверяет все эндпоинты по ролям и ошибки (110 проверок), `api-write-test.mjs` — записи (23 проверки, только тестовая база).
- **Боевые данные — с осторожностью.** Перед каждым изменением схемы на Supabase — дамп `pg_dump`. Миграции сначала проверялись на тестовой базе и в транзакции с откатом, и только потом применялись. Записи API на боевой базе не запускались без явного решения.
- **Диагностика по логам.** Ошибки разбирались по журналу приложения и по SQL-ошибкам. Так найдены: перепутанные аргументы `ConflictError`, некорректный JSON, дублирование заголовков nginx, отсутствие прав на последовательности, RLS, молча скрывающий строки в резервной копии.
- **Ошибки, которые допустил ассистент, и как их исправили.** Один раз ассистент остановил боевой бэкенд при очистке процессов, другой раз не распознал, что `/api` переписан shell-оболочкой, и попал в бандл неверный адрес. Оба случая проверены и исправлены.
- **Документация.** Описания в `docs/` написаны по проверенным ответам сервера. Утверждения, которые не проверялись, помечены как непроверенные (домен и сертификат nginx, миграции в контейнере под владельцем — проверены).

Что решал человек:
- состав системы (Supabase или self-hosted, своя аутентификация вместо Supabase Auth);
- правила доступа по ролям и станциям;
- какие изменения можно вносить в боевую базу и когда;
- что сделать с найденными рисками (тестовые пароли в публичном репозитории; нестабильный пулер Supabase — решения пока не приняты).

---

## 6. Открытые вопросы

1. Тестовые пароли (`admin`, `manager`, `analyst`, `viewer`) лежат в публичном репозитории и работают на боевой базе. Нужно сменить и убрать из файлов.
2. Пулер Supabase время от времени не отвечает: нужны решения по таймаутам или по состоянию проекта.
3. Домен, сертификат и продакшн-развёртывание nginx.
4. Задание проверки доступности в Планировщике ещё не зарегистрировано.
