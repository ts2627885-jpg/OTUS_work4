# АЗС-Пульт v2.1

Система управления ценами на топливо для сети автозаправочных станций: список станций, цены и продажи,
конкуренты, погода и трафик, аналитика, рекомендации по ценам с оценкой эффекта, загрузка CSV и ролевой доступ.

Продакшен: https://otuswork5.vercel.app

## Содержание

- [Требования](#требования)
- [Структура репозитория](#структура-репозитория)
- [Быстрый старт](#быстрый-старт)
- [Загрузка данных](#загрузка-данных)
- [Режим моков](#режим-моков)
- [Тесты и проверки](#тесты-и-проверки)
- [CI/CD и деплой](#cicd-и-деплой)
- [Интеграции](#интеграции)
- [Мониторинг и логирование](#мониторинг-и-логирование)
- [Роли](#роли)
- [Безопасность](#безопасность)
- [Документация](#документация)

## Требования

| Компонент | Версия | Проверка |
|---|---|---|
| Node.js | 18+ (в CI и на Vercel — 24) | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 14+ (проверено на 18; продакшен — Supabase, PostgreSQL 17) | `psql --version` |
| Python | 3.9+ (`seed_users.py`; для пайплайна ещё pandas) | `python --version` |
| bash | Git Bash или WSL (для `run_pipeline.sh`) | — |

Тесты backend и frontend работают без браузера и без базы данных.

## Структура репозитория

```
azs-pult-fullstack/
├── backend/                 Express + TypeScript API (порт 3001)
│   ├── src/
│   │   ├── server.ts        сборка приложения и маршруты
│   │   ├── routes/          маршруты по разделам (станции, импорт, рекомендации, админка, аналитика, OAuth)
│   │   ├── services/        бизнес-логика: правила, эластичность, импорт, OAuth, проверка готовности
│   │   ├── middleware/      контекст БД (RLS), аутентификация, роли, журнал запросов
│   │   ├── config/          подключение к БД и контекст запроса
│   │   ├── database/        миграции 001–018 (`migrations/`), скрипты учёток
│   │   └── utils/           логгер, ошибки, валидаторы
│   ├── tests/               unit и integration тесты (Jest)
│   ├── seed_users.py        создание тестовых пользователей (пароли из переменных окружения)
│   └── Dockerfile
├── frontend/                Vue 3 + Vite (порт 3000)
│   ├── src/                 экраны, компоненты, api, stores (Pinia), мок-адаптер, тесты (Vitest)
│   └── scripts/             обновление фикстур моков
├── api/index.js             serverless-обёртка Express для Vercel
├── vercel.json              сборка, маршруты и заголовки безопасности для Vercel
├── .github/workflows/ci.yml CI: формат, lint, типы, тесты, сборка, безопасность, Docker
├── _data/                   схема БД, исходные CSV и пайплайн (`_BD/pipeline`)
├── db/                      локальный Docker-стек PostgreSQL с ролью приложения
├── scripts/                 PowerShell и Node-утилиты (расписание, проверки API)
├── docs/                    документация (см. раздел «Документация»)
└── .mcp.json                MCP-сервер Supabase для ассистента
```

## Быстрый старт

### 1. База данных

```bash
psql -h localhost -U postgres -c "CREATE DATABASE azs_pult;"
```

Схема создаётся миграциями. Файл `_data/schema.sql` — это миграция 001, отдельно его загружать не нужно.

### 2. Backend

```bash
cd backend
cp .env.example .env            # заполните DB_* и JWT_SECRET (не короче 32 символов)
npm install
npm run migrate                 # применить миграции 001–018
export ADMIN_PASSWORD='...' MANAGER_PASSWORD='...' ANALYST_PASSWORD='...' VIEWER_PASSWORD='...'
python seed_users.py            # тестовые пользователи, пароли не короче 8 символов
npm run dev                     # http://localhost:3001
```

Пароли тестовых пользователей задаются переменными окружения и нигде не хранятся. Скрипт их не выводит.

Основные переменные (`backend/.env`, полный список в `.env.example`):

| Переменная | Назначение |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | подключение к PostgreSQL; для pooler Supabase `DB_USER` = `<роль>.<project-ref>` |
| `JWT_SECRET` | секрет токенов, не короче 32 символов |
| `FRONTEND_URL` | адреса, с которых разрешены запросы (CORS) |
| `LOG_TO_DB` | `true`: предупреждения и ошибки пишутся в таблицу `app_logs` |
| `PG_DUMP_PATH` | путь к `pg_dump` той же версии, что сервер (для резервных копий) |

Проверка работы: `http://localhost:3001/api/health/ready` (проверяет и приложение, и базу).

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local      # при необходимости: VITE_API_URL
npm install
npm run dev                     # http://localhost:3000
```

Вход — под учётной записью, которую создал `seed_users.py`. Права по ролям — в разделе «Роли».

### 4. Пересчёт рекомендаций

```bash
cd backend
npm run recommendations:generate
```

То же делает кнопка «Сформировать» на странице рекомендаций. Ежедневный запуск в Windows настраивается скриптом
`scripts/schedule-recommendations.ps1` (от имени администратора).

## Загрузка данных

Два способа:

1. **Через интерфейс:** раздел «Импорт». Принимаются CSV станций, цен и продаж, трафика, погоды, конкурентов,
   продаж магазина и акций. После загрузки выполняются синхронизация таблиц приложения и пересчёт рекомендаций.
2. **Пересборка из папки с CSV:** пайплайн `_data/_BD/pipeline/run_pipeline.sh` (Git Bash или WSL):

```bash
cd _data/_BD/pipeline
export PGHOST=localhost PGUSER=postgres PGDATABASE=azs_pult
export PGPASSWORD='<пароль>'            # только в окружении, в файлы не записывается
export PG_DUMP="/c/Program Files/PostgreSQL/18/bin/pg_dump.exe"
bash ./run_pipeline.sh /путь/к/папке_с_csv
```

Пайплайн пересоздаёт схему `azs` и синхронизирует таблицы приложения в `public`. Таблицы пользователей и журналов не меняются.
Перед пересборкой сохраняется резервная копия в `backups/` (хранятся последние 10).

Пример папки с данными: `_data/backup_20261008_232028/_/` (7 CSV за 01.06.2025 – 21.09.2026).

## Режим моков

Интерфейс можно проверять без backend и базы:

```bash
cd frontend
npm run dev:mock -- --port 3002
```

Ответы берутся из `src/mocks/fixtures/responses.json` — это реальные ответы API, снятые с базы. Обновить их:
`node scripts/refresh-mock-fixtures.mjs` (при работающем backend, пароль — в переменной `MOCK_PASSWORD`).
В мок-режиме на странице входа показывается демо-подсказка; в продакшен-сборке её нет.

## Тесты и проверки

```bash
cd backend && npm run format:check && npm run lint && npm run type-check && npm run test:unit && npm run build
cd frontend && npm run format:check && npm run lint && npx vitest run && npm run build
```

Интеграционные тесты (`backend/tests/integration`) работают с реальной базой (`DB_*` из `backend/.env`) и в CI не запускаются.
Тестовые пользователи с доменом `example.com` удаляются после каждого теста.

## CI/CD и деплой

- **CI** (`.github/workflows/ci.yml`) на каждый push и pull request: формат, lint, типы, тесты, сборка, аудит
  продакшен-зависимостей, Semgrep с правилами OWASP Top 10, сборка Docker-образа.
- **Деплой** — Git-интеграция Vercel: push в `main` выходит в продакшен. Отдельного workflow для деплоя нет.
- **Откат** — Vercel → Deployments → предыдущий деплой → Instant Rollback.

Подробно: [docs/CICD.md](docs/CICD.md).

## Интеграции

| Сервис | Статус |
|---|---|
| Supabase (PostgreSQL) | подключён; backend работает под ролью `azs_app` с RLS |
| Vercel | хостинг фронтенда и API |
| GitHub Actions | CI |
| Google и Яндекс ID (OAuth2) | код готов, нужны учётные данные провайдеров |
| UptimeRobot | внешний мониторинг, мониторы созданы |
| Аналитика и платежи | не подключены |

Инструкции по каждой интеграции: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md), вход через провайдеров — [docs/OAUTH.md](docs/OAUTH.md).

## Мониторинг и логирование

- **Проверка готовности:** `GET /api/health/ready` возвращает `200`, если приложение и база доступны, иначе `503`.
  Проверка запуска без базы — `GET /health` (только локально: на Vercel такой адрес открывает страницу фронтенда).
- **Внешний мониторинг:** UptimeRobot проверяет `/api/health/ready` (по ключевому слову) и страницу входа. Подробнее — [docs/MONITORING.md](docs/MONITORING.md).
- **Журналы:** логи приложения (Vercel и файлы `logs/`), таблица `app_logs` (предупреждения и ошибки), `login_logs` (входы), `audit_logs` (действия пользователей).

Подробно: [docs/LOGGING.md](docs/LOGGING.md).

## Роли

| Роль | Доступ |
|---|---|
| admin | все станции, администрирование, пользователи, журналы, резервные копии |
| manager | только назначенные станции (таблица `azs_access`), импорт, отметка выполнения рекомендаций |
| analyst | все станции: аналитика и рекомендации, без изменения данных |
| viewer | все станции: просмотр |

Роль читается из таблицы `users` при каждом запросе. Доступ к станциям дополнительно ограничен политиками RLS на уровне базы.

## Безопасность

- В репозиторий не попадают `.env`, резервные копии, логи и `node_modules` (см. `.gitignore`).
- Пароли и ключи задаются только переменными окружения и хранятся в настройках Vercel (тип Secret).
- Тестовые учётные записи предназначены только для разработки. Пароли учёток в продакшен-базе смените перед
  использованием системы в работе (см. принятый риск в аудите).
- Результаты аудита, исправления и принятые риски: [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).

## Документация

| Документ | Описание |
|---|---|
| [docs/CICD.md](docs/CICD.md) | пайплайн, деплой, откат, переменные окружения |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | подключение сервисов: Supabase, Vercel, GitHub, OAuth, UptimeRobot |
| [docs/OAUTH.md](docs/OAUTH.md) | вход через Google и Яндекс ID: консоли, переменные, проверка |
| [docs/MONITORING.md](docs/MONITORING.md) | проверка готовности, UptimeRobot, алерты |
| [docs/LOGGING.md](docs/LOGGING.md) | журналы приложения, `app_logs`, `login_logs`, `audit_logs` |
| [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) | отчёт по аудиту безопасности и статус исправлений |
| [SETUP.md](SETUP.md) | подробная установка |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | структура файлов |
| [_data/README.md](_data/README.md) | данные и аналитические запросы |
| [docs/RULES_FORMULAS.md](docs/RULES_FORMULAS.md) | формулы правил рекомендаций и эффектов |
| [docs/REFACTORING_LOG.md](docs/REFACTORING_LOG.md) | журнал работы: проблемы, решения, замеры |
| [development_report.md](development_report.md) | отчёт о разработке |

## Лицензия и поддержка

Учебный проект. Вопросы — через issues репозитория.
