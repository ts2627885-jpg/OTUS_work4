# AZS-Pult v2.1 - Deployment Guide

## 📋 Обзор

Полнофункциональное приложение для управления ценовой политикой сетей АЗС, развернутое в Docker контейнерах.

## 🚀 Быстрый старт

### Запуск всех сервисов

```bash
cd azs-pult-fullstack
docker-compose up -d
```

### Проверка статуса

```bash
docker-compose ps
```

## 🔌 Сервисы и Порты

| Сервис | URL | Статус |
|--------|-----|--------|
| **Frontend** | http://localhost:3000 | ✅ Vue 3 + Vite |
| **Backend API** | http://localhost:3000/api | ✅ Node.js Express |
| **PostgreSQL** | localhost:5432 | ✅ База данных |
| **Redis** | localhost:6379 | ✅ Кэширование |
| **Grafana** | http://localhost:3001 | 📊 Мониторинг |
| **Prometheus** | http://localhost:9090 | 📈 Метрики |
| **PgAdmin** | http://localhost:5050 | 🗄️ Управление БД |
| **Redis Commander** | http://localhost:8081 | 🔴 Управление Redis |

## 🔐 Учетные данные по умолчанию

### Frontend Login
```
Username: admin
Password: <ADMIN_PASSWORD>
```

Дополнительные пользователи:
- user / <USER_PASSWORD>
- demo / <DEMO_PASSWORD>

### PostgreSQL
```
User:     postgres
Password: postgres
Database: azs_db
Host:     localhost:5432
```

### Redis
```
Password: redispass
Port:     6379
```

### PgAdmin
```
Email:    admin@example.com
Password: admin
```

### Grafana
```
User:     admin
Password: admin
```

## 📂 Структура Проекта

```
azs-pult-fullstack/
├── frontend/                 # Vue 3 + Vite приложение
│   ├── src/
│   │   ├── api/             # HTTP клиент
│   │   ├── components/      # Vue компоненты
│   │   ├── stores/          # Pinia хранилища
│   │   └── views/           # Страницы
│   ├── Dockerfile
│   ├── .env                 # Переменные окружения
│   └── vite.config.js
│
├── backend/                  # Node.js Express сервер
│   ├── src/
│   │   ├── api/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── middleware/
│   ├── Dockerfile
│   ├── start.js             # Entry point
│   ├── package.json
│   └── tsconfig.json
│
├── nginx.conf               # Обратный прокси
├── docker-compose.yml       # Оркестрация контейнеров
├── init-db.sql             # Инициализация БД
└── prometheus.yml          # Конфигурация метрик
```

## ⚙️ Конфигурация

### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:3000/api
VITE_ENV=development
```

### Backend (переменные окружения)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/azs_db
REDIS_URL=redis://:redispass@redis:6379
JWT_SECRET=your-secret-key-change-in-production
CORS_ORIGIN=http://localhost:3000
```

## 🔧 Основные Исправления

### 1. Backend TypeScript Issues
- ✅ Заменен на простой Node.js (start.js)
- ✅ Удалены зависимости ts-node для production
- ✅ Добавлена поддержка username/email логина

### 2. Frontend API URL
- ✅ Изменен с http://localhost:3001 на http://localhost:3000/api
- ✅ Создан .env файл для переменных окружения
- ✅ Обновлен frontend/src/api/client.js

### 3. CORS Configuration
- ✅ Добавлена поддержка preflight (OPTIONS) запросов
- ✅ Установлены правильные заголовки Access-Control-*

### 4. Nginx Configuration
- ✅ Удалено дублирование upstream определений
- ✅ Упрощена конфигурация для HTTP (без SSL)
- ✅ Настроена маршрутизация на frontend и backend

### 5. Docker Issues
- ✅ Исправлены пути копирования в Dockerfile
- ✅ Синхронизированы порты между docker-compose и Dockerfile
- ✅ Добавлены правильные health checks

## 📝 Backend API Endpoints

### Authentication
```
POST   /api/auth/login      - Вход в систему
GET    /api/auth/me         - Получить текущего пользователя (требует токен)
```

### Users
```
GET    /api/users           - Список пользователей
```

### Health
```
GET    /health              - Проверка здоровья приложения
```

## 🔄 Workflow: Запуск → Разработка → Развертывание

### 1. Запуск в разработке
```bash
docker-compose up -d
# Приложение доступно на http://localhost:3000
```

### 2. Просмотр логов
```bash
# Backend
docker-compose logs -f backend

# Frontend
docker-compose logs -f frontend

# Все сервисы
docker-compose logs -f
```

### 3. Остановка
```bash
docker-compose down
```

### 4. Полная очистка
```bash
docker-compose down -v  # Удалить volumes
docker system prune      # Очистить неиспользуемые образы
```

## 🔍 Отладка

### Проверка доступности сервисов
```bash
# Backend API
curl http://localhost:3000/api

# Health check
curl http://localhost:3000/health

# PostgreSQL
psql -h localhost -U postgres -d azs_db

# Redis
redis-cli -p 6379 -a redispass
```

### Просмотр логов контейнеров
```bash
# Последние 50 строк
docker-compose logs --tail=50 backend

# В реальном времени
docker-compose logs -f backend
```

### Перестройка одного сервиса
```bash
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## 📊 Мониторинг

### Grafana
1. Открой http://localhost:3001
2. Login: admin / admin
3. Добавь Prometheus как datasource (http://prometheus:9090)

### Prometheus
1. Открой http://localhost:9090
2. Просмотри метрики с backend'а (http://backend:3000/metrics)

## 🚨 Решение Проблем

### Frontend не загружается
- Откройте браузер в режиме Incognito (Ctrl+Shift+N)
- Очистите кэш браузера (DevTools → Storage → Clear)
- Проверьте логи: `docker-compose logs frontend`

### Login не работает
```bash
# Проверьте backend логи
docker-compose logs backend

# Убедитесь в доступности API
curl http://localhost:3000/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
```

### Database connection error
```bash
# Проверьте PostgreSQL
docker-compose logs postgres

# Проверьте переменные окружения
docker-compose exec backend env | grep DATABASE
```

### Port already in use
```bash
# Найдите процесс на порту 3000
lsof -i :3000

# Или измените порт в docker-compose.yml
```

## 📚 Переменные Окружения

### .env файл в корне проекта (опционально)
```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=azs_db

# Redis
REDIS_PASSWORD=redispass

# Backend
JWT_SECRET=your-super-secret-key
API_PORT=3000

# Frontend
FRONTEND_PORT=3000

# Grafana
GRAFANA_PASSWORD=admin

# PgAdmin
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin
```

## 🔐 Production Considerations

⚠️ **ВАЖНО для продакшена:**

1. Измените все пароли по умолчанию
2. Включите HTTPS (SSL/TLS) в nginx.conf
3. Установите строгую CORS политику
4. Используйте переменные окружения для secrets
5. Включите логирование и мониторинг
6. Настройте резервные копии БД
7. Используйте secrets manager (HashiCorp Vault, AWS Secrets Manager)

## 📞 Support

При возникновении проблем:
1. Проверьте логи: `docker-compose logs`
2. Убедитесь, что все контейнеры запущены: `docker-compose ps`
3. Проверьте переменные окружения: `docker-compose config`
4. Перезагрузитесь: `docker-compose restart`

---

**Последнее обновление:** 2026-10-08  
**Версия:** 2.1.0
