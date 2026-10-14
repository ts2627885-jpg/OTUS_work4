# АЗС-Пульт v2.1 - Руководство по установке и запуску

Краткое описание проекта и структура репозитория — в [README.md](README.md). Здесь — пошаговая установка, запуск, проверка и типовые проблемы.

## 📋 Системные требования

| Компонент | Версия | Проверка |
|---|---|---|
| Node.js | 18+ (в CI используется 24) | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 14+ (проверено на 18) | `psql --version` |
| Python | 3.9+ (для `seed_users.py`, `import_data.py`; пайплайн дополнительно требует pandas) | `python --version` |
| bash | Git Bash или WSL (для `run_pipeline.sh`) | — |
| ОС | Windows, macOS, Linux | — |

Docker Compose в репозитории тоже есть (см. [docker-compose.yml](docker-compose.yml)), но основной сценарий ниже — запуск без Docker.

## 🔧 Установка

### Шаг 1. База данных

```bash
# 1.1 Создать базу
psql -h localhost -U postgres -c "CREATE DATABASE azs_pult;"
```

### Шаг 2. Backend

```bash
cd backend

# 2.1 Зависимости
npm install

# 2.2 Файл окружения: скопировать шаблон и заполнить значения
cp .env.example .env
```

Основные переменные в `backend/.env` (полный список — в [backend/.env.example](backend/.env.example)):

| Переменная | Назначение |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | подключение к PostgreSQL |
| `JWT_SECRET` | секрет для токенов; не короче 32 символов, в production — свой |
| `FRONTEND_URL` | адрес фронтенда для CORS, например `http://localhost:3000` |
| `PORT` | порт API, по умолчанию `3001` |
| `PG_DUMP_PATH` | путь к `pg_dump` той же версии, что и сервер (для резервных копий) |

```bash
# 2.3 Применить миграции (схема public: 001 — базовая схема, далее 002–017)
npm run migrate

# 2.4 Создать тестовых пользователей (роли admin, manager, analyst, viewer)
#     пароль берётся из переменной окружения DB_PASSWORD
python seed_users.py
```

> Схему не нужно загружать вручную из `_data/schema.sql`: эта же схема является миграцией `001`. Ручная загрузка нужна только для восстановления старой базы, созданной до появления журнала миграций (см. комментарий в `backend/src/database/migrate.ts`, опция `--baseline`).

### Шаг 3. Frontend

```bash
cd frontend

# 3.1 Зависимости
npm install

# 3.2 Файл окружения
cp .env.example .env.local
# VITE_API_URL=http://localhost:3001/api
```

### Шаг 4. Данные (опционально)

Загрузить CSV можно двумя способами:

1. **Через интерфейс:** раздел «Импорт» в приложении (принимаются CSV станций, цен и продаж, трафика, погоды, конкурентов, продаж магазина и акций).
2. **Пересборкой из папки с CSV:** пайплайн `_data/_BD/pipeline/run_pipeline.sh` (Git Bash или WSL). Пересоздаёт схему `azs`, синхронизирует таблицы приложения в `public` и пересчитывает рекомендации. Перед пересборкой делается резервная копия в `backups/` (хранятся последние 10).

```bash
cd _data/_BD/pipeline
export PGHOST=localhost PGUSER=postgres PGDATABASE=azs_pult
export PGPASSWORD='<пароль>'            # только в окружении, в файлы не записывать
export PG_DUMP="/c/Program Files/PostgreSQL/18/bin/pg_dump.exe"
bash ./run_pipeline.sh /путь/к/папке_с_csv
```

Пример данных: `_data/backup_20261008_232028/_/` (7 CSV за 01.06.2025 – 21.09.2026).

После загрузки пересчитать рекомендации (то же делает кнопка «Сформировать» на странице рекомендаций):

```bash
cd backend
npm run recommendations:generate
```

## 🚀 Запуск

### Вариант 1. Разработка (раздельный запуск)

**Терминал 1 — Backend**
```bash
cd backend
npm run dev        # http://localhost:3001
```

**Терминал 2 — Frontend**
```bash
cd frontend
npm run dev        # http://localhost:3000
```

### Вариант 2. Сборка

```bash
# Backend
cd backend
npm run build      # tsc + tsc-alias, результат в dist/
npm start          # node dist/server.js

# Frontend
cd frontend
npm run build      # результат в dist/
npm run preview
```

### Вариант 3. Без базы (mock-режим фронтенда)

Интерфейс можно открыть без backend и PostgreSQL. Ответы берутся из `frontend/src/mocks/fixtures/responses.json`:

```bash
cd frontend
npm run dev:mock
```

В mock-режиме на странице входа показывается подсказка с демо-учётной записью. В обычной сборке её нет.

## 📝 Первые шаги

### 1. Проверка API

```bash
curl http://localhost:3001/api/health
# {"status":"ok","timestamp":"...","uptime":...}
```

Также доступны `GET /health` и `GET /healthz` с тем же ответом.

### 2. Вход в систему

Откройте http://localhost:3000 и войдите под одной из тестовых учётных записей, созданных `seed_users.py`. Роли:

| Роль | Доступ |
|---|---|
| admin | всё, включая расчёт по сети, администрирование, резервные копии |
| manager | управление своими станциями, импорт, отметка выполнения рекомендаций |
| analyst | аналитика и рекомендации, без изменения данных |
| viewer | просмотр станций и рекомендаций |

Пароли тестовых учётных записей в документации не приводятся; их задаёт `seed_users.py`. Эти учётные записи предназначены только для разработки.

### 3. Проверка тестами

```bash
cd backend && npm test             # Jest (интеграционные тесты требуют БД из backend/.env)
cd frontend && npx vitest run      # Vitest + jsdom
```

Проверки как в CI:

```bash
cd backend && npm run lint && npm run type-check && npm run test:unit && npm run build
cd frontend && npm run lint && npx vitest run && npm run build
```

## 📁 Основные маршруты API

Полный список — в файлах `backend/src/routes/*.ts`. Все маршруты, кроме `/api/health`, `/api/auth/login` и `/api/auth/register`, требуют заголовок `Authorization: Bearer <token>`.

| Раздел | Маршруты |
|---|---|
| Здоровье | `GET /api/health`, `GET /health`, `GET /healthz` |
| Авторизация | `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/profile` |
| Станции | `GET /api/azs`, `GET /api/azs/:id`, `POST /api/azs`, `PUT /api/azs/:id`, `DELETE /api/azs/:id`, `GET /api/stations/check` |
| Данные станции | `GET /api/azs/:id/sales`, `/traffic`, `/weather`, `/competitors` |
| Цены | `GET /api/prices` |
| Дашборд | `GET /api/dashboard` |
| Аналитика | `GET /api/analytics/:tab`, `GET /api/analysis/rules` |
| Рекомендации | `GET /api/recommendations`, `POST /api/recommendations/generate`, `GET /api/recommendations/azs/:azsId`, `POST /api/recommendations/:id/complete` |
| Импорт | `POST /api/import/csv`, `GET /api/import/summary`, `GET /api/import/history`, `GET /api/import/backups` |
| Администрирование | `GET/POST /api/admin/users`, `DELETE /api/admin/users/:id`, `GET/PUT /api/admin/users/:id/azs`, `GET /api/admin/logs/login`, `GET /api/admin/logs/audit`, `GET/PUT /api/admin/settings`, `GET /api/admin/settings/export`, `POST /api/admin/settings/import`, `GET /api/admin/settings/history`, `POST /api/admin/backup`, `GET /api/admin/stats/overall`, `POST /api/admin/price-test/draft`, `GET /api/admin/price-test` |

## 🐛 Troubleshooting

### Backend не запускается

```bash
node -v                                  # версия Node.js
cd backend && rm -rf node_modules && npm install
cat .env                                 # переменные заданы? DB_* и JWT_SECRET
psql -h localhost -U postgres -d azs_pult -c "SELECT COUNT(*) FROM azs;"
```

Если `azs` не найдена, миграции не применены: выполните `npm run migrate`.

### Frontend не подключается к API

```bash
cat frontend/.env.local                  # VITE_API_URL=http://localhost:3001/api
curl http://localhost:3001/api/health    # backend запущен?
```

Очистите кэш браузера (Ctrl+Shift+Delete) и перезапустите `npm run dev`: Vite читает `.env.local` только при старте.

### БД недоступна

```bash
psql -h localhost -U postgres -c "SELECT version();"
psql -h localhost -U postgres -l | grep azs_pult
```

Если база нужна заново:
```bash
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS azs_pult;"
psql -h localhost -U postgres -c "CREATE DATABASE azs_pult;"
cd backend && npm run migrate && python seed_users.py
```

### Ошибка при загрузке данных

- Проверьте, что файлы CSV существуют и кодировка UTF-8.
- Для пайплайна проверьте `PG_DUMP`: версия `pg_dump` должна совпадать с версией сервера PostgreSQL.
- Журнал пайплайна: `_data/_BD/pipeline/logs/run_<дата_время>.log`.

### Порт занят

```bash
# Windows
netstat -ano | findstr :3001
# macOS / Linux
lsof -i :3001
```

Завершите процесс или смените порт (`PORT` в `backend/.env`, порт фронтенда в `frontend/vite.config.js`).

## 🔒 Безопасность (перед выводом в эксплуатацию)

1. **Сменить `JWT_SECRET`** на случайную строку:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Удалить или отключить тестовые учётные записи** и сменить пароли БД.
3. **Настроить CORS:** `FRONTEND_URL` должен указывать только на боевой адрес фронтенда.
4. **Включить HTTPS** (например, через reverse proxy с Let's Encrypt).
5. **Настроить резервное копирование БД** и проверить восстановление.
6. **Не коммитить `.env`**: в `.gitignore` он уже исключён, проверяйте перед каждым коммитом.

Деплой: фронтенд и API публикуются на Vercel (см. [vercel.json](vercel.json)); деплой запускается GitHub Actions после успешного CI.

## 📚 Документация

- [README.md](README.md) — обзор и быстрый старт
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — структура файлов
- [_data/README.md](_data/README.md) — данные и аналитические запросы
- [docs/RULES_FORMULAS.md](docs/RULES_FORMULAS.md) — формулы правил и эффектов
- [development_report.md](development_report.md) — отчёт о разработке

---

**Версия**: 2.1.0
**Последнее обновление**: 14.10.2026
