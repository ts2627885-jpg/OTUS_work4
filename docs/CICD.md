# CI/CD: настройка и работа пайплайна

Пайплайн проверяет каждый push и pull request. Деплой в продакшен выполняет Vercel при пуше в `main`.

## Где что настроено

| Что | Файл или место |
|---|---|
| Проверки качества и сборка | `.github/workflows/ci.yml` |
| Сборка и маршруты для Vercel | `vercel.json` (`buildCommand`, `rewrites`, `headers`) |
| Серверная функция API | `api/index.js` (использует `backend/dist`) |
| Деплой | Git-интеграция Vercel с репозиторием `OTUS_work5` (ветка `main`) |
| Переменные окружения | Vercel → проект `otus_work5` → Settings → Environment Variables |

Отдельного workflow для деплоя нет: `deploy.yml` удалён. Прежний вариант с деплой-хуком пропускал шаг без секрета и дублировал бы деплой Vercel.

## Этапы в `ci.yml`

Запускается на каждый `push` и `pull_request`. Для одной ветки новый запуск отменяет предыдущий (`concurrency`).

| Job | Шаги |
|---|---|
| **Backend** | установка (`npm ci`) → Prettier (`format:check`) → ESLint (`lint`) → типы (`type-check`) → unit-тесты (`test:unit`) → сборка (`build`) |
| **Frontend** | установка (`npm ci`) → Prettier (`format:check`) → ESLint (`lint`) → тесты (`npx vitest run`) → сборка (`build`) |
| **Безопасность** | аудит продакшен-зависимостей backend и frontend (`npm audit --omit=dev --audit-level=high`) → Semgrep с правилами OWASP Top 10 (`--error`, падает при находках уровня ERROR) |
| **Docker** | сборка образа бэкенда из `backend/Dockerfile` (без публикации), только после job Backend |

Интеграционные тесты (`tests/integration`) в CI не запускаются: им нужна база. Их запускают вручную, когда база доступна.

Все job используют Node.js 24. Таймаут каждого job — 15 минут.

## Деплой на Vercel

1. Push в `main` запускает CI и одновременно сборку Vercel по `vercel.json`.
2. Сборка Vercel: `backend` (`npm ci`, `npm run build`), затем `frontend` (`npm ci`, `VITE_API_URL=/api npm run build`).
3. Если сборка упала, новый деплой не выходит на продакшен, а предыдущий продолжает работать.
4. Результат виден в Vercel → Deployments и в GitHub → Actions.

Важно: Vercel не ждёт прохождения CI. Если тесты CI упали, а сборка Vercel прошла, код попадёт на продакшен. Чтобы деплой ждал CI, включите проверку GitHub в настройках проекта Vercel (Settings → Git).

## Откат

1. Vercel → Deployments → выберите последний рабочий деплой → ⋯ → **Instant Rollback**.
2. Для отката кода: `git revert <коммит>` в `main`, push. Вернётся CI и новый деплой.

## Переменные окружения

Значения задаются в Vercel, в репозиторий не попадают. Тип **Secret** для паролей и ключей (их нельзя прочитать после сохранения), **Config** для несекретных значений.

| Переменная | Назначение |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | подключение к Supabase; `DB_USER` = `azs_app.<project-ref>` |
| `DB_POOL_MAX`, `DB_CONNECT_TIMEOUT`, `DB_POOL_IDLE_TIMEOUT` | параметры пула |
| `JWT_SECRET` | подпись токенов, не короче 32 символов |
| `FRONTEND_URL` | адрес для CORS |
| `LOG_TO_DB` | `true`: предупреждения и ошибки пишутся в `app_logs` |
| `OAUTH_PUBLIC_URL`, `OAUTH_STATE_SECRET`, `GOOGLE_*`, `YANDEX_*` | вход через OAuth2, см. [OAUTH.md](OAUTH.md) |
| `NODE_ENV` | `production` |

Переменная `DB_USER` в Preview-окружении отличается от продакшена: там по-прежнему `postgres`.

## Известные предупреждения

- GitHub переводит `ubuntu-latest` на Ubuntu 26 с 19.10.2026. Нужно зафиксировать `ubuntu-24.04` до этой даты.
- `actions/checkout@v4` работает на Node.js 20, который GitHub устаревает. Нужно обновить до `actions/checkout@v5`.
- Linter показывает 95 предупреждений в backend и 19 во frontend. Ошибок нет, предупреждения не блокируют CI.

## Как повторить проверки локально

```bash
cd backend && npm run format:check && npm run lint && npm run type-check && npm run test:unit && npm run build
cd frontend && npm run format:check && npm run lint && npx vitest run && npm run build
```
