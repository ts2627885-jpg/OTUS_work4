# Интеграции сервисов

Список внешних сервисов, которые использует проект, и что нужно сделать, чтобы подключить или перенастроить каждый из них.

| Сервис | Для чего | Статус |
|---|---|---|
| Supabase (PostgreSQL) | база данных приложения | подключён, продакшен |
| Vercel | хостинг фронтенда и API | подключён, продакшен |
| GitHub Actions | CI: проверки качества и безопасности | подключён |
| Google и Яндекс ID (OAuth2) | вход через внешние аккаунты | код готов, нужны учётные данные |
| UptimeRobot | внешний мониторинг и алерты | мониторы созданы, нужна проверка |
| Аналитика (GA, Метрика, Sentry) | сбор событий | **не подключена** |
| Платёжные системы | оплата | **не подключены** |

Если подключаете аналитику или платежи, это новая интеграция: добавьте её в таблицу выше и опишите здесь.

## Supabase

**Подключение backend.** Переменные `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` в `backend/.env` (локально) или в Vercel (продакшен). Для pooler Supabase пользователь записывается как `<роль>.<project-ref>`, например `azs_app.glnqdukqwapakhsuejcj`. Без суффикса pooler отвечает `ENOIDENTIFIER: no tenant identifier provided`.

**Роль приложения.** Backend подключается под ролью `azs_app` без `BYPASSRLS`, чтобы RLS применялась. Роль `postgres` обходит RLS, поэтому её не используем в продакшене.

**Миграции.** Файлы в `backend/src/database/migrations/` (001–018) применяются командой `npm run migrate` из `backend/`. Порядок учитывается по имени файла, применённые миграции записываются в `schema_migrations`.

**Тестовые пользователи.** Создаются `backend/seed_users.py` с паролями из переменных `ADMIN_PASSWORD`, `MANAGER_PASSWORD`, `ANALYST_PASSWORD`, `VIEWER_PASSWORD` (не короче 8 символов).

**Смена пароля учётки.** Через `backend/src/database/update-passwords.ts` (меняет четыре учётки) или SQL-запросом с `extensions.crypt(...)`, если нужна одна учётка.

**Проверка состояния.** Рекомендации безопасности и производительности: `get_advisors` через MCP-сервер Supabase (`.mcp.json` в корне репозитория) или Dashboard → Advisors.

**MCP-сервер.** Настроен в `.mcp.json`. Авторизация через OAuth в интерактивной сессии: `/mcp` → supabase. Режим только для чтения включается параметром `read_only=true` в URL.

## Vercel

**Подключение.** Проект `otus_work5`, команда `prog-db39`. Привязка локальной папки: `vercel link` из `azs-pult-fullstack`. Вход: `vercel login`.

**Переменные.** Задаются в Vercel или через CLI: `vercel env add <ИМЯ> production`. Значения паролей и ключей вводите в запросе CLI, в чат и файлы не сохраняйте. Тип для паролей и ключей — **Secret**.

**Деплой.** Git-интеграция: каждый push в `main` выходит в продакшен. Подробнее — [CICD.md](CICD.md).

**Токен для API (необязательно).** Vercel → Account Settings → Tokens. Храните в переменной сессии, не в файлах проекта.

## GitHub Actions

Workflow `.github/workflows/ci.yml` запускается сам, отдельной настройки не требует. Секретов для CI сейчас нет. Если понадобится публикация артефактов или токены, задавайте их в Settings → Secrets and variables → Actions.

## Вход через Google и Яндекс ID (OAuth2)

Полная инструкция — [OAUTH.md](OAUTH.md). Кратко:
1. Создать OAuth-приложение в Google Cloud Console и в Яндекс ID.
2. Указать redirect URI вида `https://otuswork5.vercel.app/api/auth/oauth/<provider>/callback`.
3. Получить Client ID и Client Secret, задать их в Vercel (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`).
4. Задать `OAUTH_PUBLIC_URL` и `OAUTH_STATE_SECRET`.
5. Применить миграцию `018_oauth_accounts.sql` к продакшен-базе.
6. Сделать передеплой.

Кнопки провайдеров появятся на странице входа только для тех, у кого заданы учётные данные.

## UptimeRobot

Мониторы: `https://otuswork5.vercel.app/api/health/ready` (keyword `"status":"ok"`) и `https://otuswork5.vercel.app/login`. Подробнее — [MONITORING.md](MONITORING.md). API-ключ UptimeRobot храните в переменной окружения пользователя (`setx`), не в файлах и не в чате.

## Semgrep (в CI)

Правила `p/owasp-top-ten`, `p/nodejs`, `p/javascript`, `p/typescript`. Версия зафиксирована в `ci.yml` (1.180.0). Регистрация не нужна, правила загружаются из публичного реестра.

## Что не подключено

- **Аналитика.** В коде нет SDK для Google Analytics, Яндекс Метрики или Sentry. Если добавляете, передавайте только обезличенные события, без логинов и почт.
- **Платежи.** Интеграции с платёжными системами нет.
