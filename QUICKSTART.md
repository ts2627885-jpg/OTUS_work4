# ⚡ Быстрый старт АЗС-Пульт v2.1

Начни за 5 минут! 🚀

## Вариант 1: С Docker (Рекомендуется)

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd azs-pult-fullstack

# 2. Подготовить окружение
cp .env.example .env

# 3. Запустить всё
docker-compose up -d

# 4. Подождать инициализацию
sleep 30

# 5. Создать админа
docker-compose exec backend node -e "
const authService = require('./services/auth.service');
authService.register('admin', 'admin@example.com', '<ADMIN_PASSWORD>', 1)
  .then(() => console.log('✅ Admin created'))
  .catch(err => console.error(err.message));
"

# 6. Открыть в браузере
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# PgAdmin: http://localhost:5050
```

### Тестовые учетные данные

```
Username: admin
Password: <ADMIN_PASSWORD>
Email: admin@example.com
Role: Администратор
```

## Вариант 2: Локально (Без Docker)

### Шаг 1: Установить зависимости

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### Шаг 2: PostgreSQL

```bash
# macOS
brew install postgresql
brew services start postgresql

# Linux
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start

# Создать БД
psql -U postgres

# В psql:
CREATE ROLE azs_admin WITH LOGIN PASSWORD 'secure-password';
CREATE DATABASE azs_pult OWNER azs_admin;
ALTER ROLE azs_admin CREATEDB;
```

### Шаг 3: Redis

```bash
# macOS
brew install redis
redis-server

# Linux
sudo apt-get install redis-server
redis-server
```

### Шаг 4: Запустить Backend

```bash
cd backend
cp .env.example .env

# Отредактировать .env:
# DB_HOST=localhost
# DB_PORT=5432
# REDIS_URL=redis://localhost:6379

npm run dev
# Откроется на http://localhost:3001
```

### Шаг 5: Запустить Frontend (в новом терминале)

```bash
cd frontend
cp .env.example .env

npm run dev
# Откроется на http://localhost:3000
```

## Проверка установки

```bash
# 1. API доступен
curl http://localhost:3001/health
# Ожидается: {"status":"OK","timestamp":"..."}

# 2. Вход в систему
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'

# 3. Открыть фронтенд
# http://localhost:3000 (логин: admin / пароль: <ADMIN_PASSWORD>)
```

## 📚 Документация

- 📖 [Полная документация](README.md)
- 🔧 [Установка и настройка](INSTALL.md)
- 🎨 [Frontend документация](FRONTEND.md)
- 📊 [API документация](README.md#-api-endpoints)

## 🆘 Помощь

### Ошибка подключения к БД

```bash
# Docker
docker-compose restart postgres

# Локально
psql -U azs_admin -h localhost -d azs_pult -c "SELECT 1"
```

### Port уже занят

```bash
# Изменить в .env
PORT=3002

# Или найти процесс
lsof -i :3001
kill -9 <PID>
```

### Redis не подключается

```bash
# Проверить статус
redis-cli ping
# Должно вернуть: PONG

# Если Docker
docker-compose restart redis
```

### Забыли пароль админа

```bash
# Docker
docker-compose exec backend node -e "
const authService = require('./services/auth.service');
authService.register('newadmin', 'new@example.com', 'NewPass123', 1)
  .then(() => console.log('New admin created'))
  .catch(err => console.error(err));
"

# Локально
# Отредактировать базу данных напрямую через PgAdmin
```

## 🎯 Следующие шаги

1. ✅ **Создать дополнительных пользователей** через админ панель
2. ✅ **Загрузить данные АЗС** через импорт CSV
3. ✅ **Настроить фронтенд** (измените цвета, логотип в FRONTEND.md)
4. ✅ **Развернуть в production** (смотри README.md)

## 📞 Поддержка

- 💬 Создавайте issues на GitHub
- 📧 Напишите в support
- 📖 Читайте документацию

---

**Готово! 🎉** Приложение полностью функционально и готово к использованию.
