# 📦 Инструкция по установке АЗС-Пульт v2.1

## Вариант 1: Быстрая установка с Docker (Рекомендуется) ⚡

### Шаг 1: Подготовка

```bash
# Клонировать репозиторий
git clone <repo-url>
cd azs-pult-fullstack

# Создать .env файл
cp .env.example .env
```

### Шаг 2: Запуск

```bash
# Поднять все сервисы (PostgreSQL, Redis, Backend)
docker-compose up -d

# Ждём инициализации БД (~30 сек)
sleep 30

# Проверить статус
docker-compose ps
```

Ожидаемый вывод:
```
NAME                  STATUS
azs-pult-db          Up (healthy)
azs-pult-redis       Up
azs-pult-backend     Up (healthy)
azs-pult-pgadmin     Up
```

### Шаг 3: Создание администратора

```bash
docker-compose exec backend node -e "
const authService = require('./services/auth.service');
authService.register('admin', 'admin@example.com', 'Admin123456', 1)
  .then(() => console.log('✅ Admin user created'))
  .catch(err => console.error('Error:', err.message));
"
```

### Шаг 4: Проверка

```bash
# Проверить API
curl http://localhost:3001/health

# Должно вернуть:
# {"status":"OK","timestamp":"2026-10-08T..."}
```

### Доступ к сервисам

| Сервис | URL | Логин | Пароль |
|--------|-----|-------|--------|
| **API** | http://localhost:3001 | - | - |
| **PgAdmin** | http://localhost:5050 | admin@example.com | admin |
| **Redis** | localhost:6379 | - | - |

---

## Вариант 2: Локальная разработка (без Docker)

### Требования

- Node.js 20+
- PostgreSQL 16
- Redis 7

### Шаг 1: PostgreSQL

```bash
# macOS
brew install postgresql

# Linux (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# Windows
# Скачать с https://www.postgresql.org/download/windows/
```

Создать БД:
```bash
psql -U postgres

# В psql:
CREATE ROLE azs_admin WITH LOGIN PASSWORD 'secure-password';
CREATE DATABASE azs_pult OWNER azs_admin;
ALTER ROLE azs_admin CREATEDB;
```

Запустить миграции:
```bash
psql -U azs_admin -d azs_pult -f backend/migrations/001_init_schema.sql
```

### Шаг 2: Redis

```bash
# macOS
brew install redis
redis-server

# Linux
sudo apt-get install redis-server
redis-server

# Windows
# Скачать https://github.com/microsoftarchive/redis/releases
redis-server.exe
```

### Шаг 3: Backend

```bash
cd backend

# Установить зависимости
npm install

# Создать .env
cp ../.env.example .env

# Обновить переменные в .env:
# DB_HOST=localhost
# REDIS_URL=redis://localhost:6379

# Запустить в режиме разработки
npm run dev

# Должно вывести:
# ╔════════════════════════════════════════╗
# ║      АЗС-Пульт Backend API v2.1       ║
# ║  Server running on port 3001           ║
# ║  Environment: development              ║
# ╚════════════════════════════════════════╝
```

### Шаг 4: Frontend (опционально)

```bash
cd frontend

# Установить зависимости
npm install

# Создать .env
cp .env.example .env

# Запустить dev сервер
npm run dev

# Откроется http://localhost:3000
```

**Функциональность фронтенда:**
- ✅ Login / Register с JWT аутентификацией
- ✅ Панель управления (Dashboard)
- ✅ Список АЗС станций
- ✅ Детальный просмотр АЗС
- ✅ Рекомендации и аналитика
- ✅ Импорт данных CSV
- ✅ Администрирование (только для admin)
- ✅ Сохранение авторизации в localStorage
- ✅ Проверка прав доступа по ролям

---

## 🔐 Первая авторизация

### 1. Получить токен

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin123456"
  }'

# Ответ:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": {
#     "id": "uuid",
#     "username": "admin",
#     "email": "admin@example.com",
#     "role": "admin"
#   }
# }
```

### 2. Использовать токен

```bash
curl http://localhost:3001/api/protected \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Ответ:
# {
#   "message": "Protected route",
#   "user": {
#     "userId": "uuid",
#     "username": "admin",
#     "role": "admin",
#     "permissions": [...]
#   }
# }
```

---

## 📊 Загрузка данных

Данные загружаются через REST API:

```bash
# Пример загрузки данных АЗС
curl -X POST http://localhost:3001/api/azs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "АЗС №1",
    "location_region": "Тверская область"
  }'
```

---

## 🔍 Debugging

### Посмотреть логи

```bash
# Docker
docker-compose logs -f backend
docker-compose logs -f postgres

# Локально
# Backend логи в консоли, PostgreSQL в /var/log/postgresql/
```

### Подключиться к БД напрямую

```bash
# Docker
docker-compose exec postgres psql -U azs_admin -d azs_pult

# Локально
psql -U azs_admin -d azs_pult
```

### Проверить Redis

```bash
# Docker
docker-compose exec redis redis-cli

# Локально
redis-cli
```

### Получить информацию о пользователях

```bash
psql -U azs_admin -d azs_pult
SELECT id, username, email, role_id FROM users;
```

---

## 🛑 Остановка

```bash
# Docker
docker-compose down

# Удалить всё (including data)
docker-compose down -v

# Локально - просто Ctrl+C в каждом терминале
```

---

## ⚠️ Часто встречающиеся ошибки

### "Port 3001 already in use"

```bash
# Найти процесс
lsof -i :3001

# Убить процесс
kill -9 <PID>

# Или используй другой порт
PORT=3002 npm run dev
```

### "Cannot connect to PostgreSQL"

```bash
# Проверить статус
docker-compose ps postgres

# Перезагрузить
docker-compose restart postgres

# Или проверить права доступа
psql -U azs_admin -h localhost -d azs_pult -c "SELECT 1"
```

### "jwt: missing key"

Убедиться, что JWT_SECRET установлен в .env:
```
JWT_SECRET=your-super-secret-key-min-32-chars
```

---

## ✅ Проверка установки

```bash
# Все эти команды должны вернуть успешный ответ

# 1. API доступен
curl http://localhost:3001/health

# 2. БД доступна
docker-compose exec postgres psql -U azs_admin -c "SELECT NOW();"

# 3. Redis доступен
docker-compose exec redis redis-cli ping

# 4. Можно залогиниться
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123456"}'
```

---

## 🎉 Готово!

Приложение готово к использованию. Следующие шаги:

1. ✅ Создать дополнительных пользователей
2. ✅ Загрузить данные АЗС
3. ✅ Импортировать данные о продажах, трафике, конкурентах
4. ✅ Настроить фронтенд (Vue 3)
5. ✅ Развернуть в production

---

**Нужна помощь?** Смотри README.md или создавай issue
