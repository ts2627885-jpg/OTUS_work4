# АЗС-Пульт v2.1 - Полное руководство по установке и запуску

## 📋 Системные требования

- **Node.js**: 16+ (проверить: `node -v`)
- **npm**: 8+ (проверить: `npm -v`)
- **PostgreSQL**: 15+ (проверить: `psql --version`)
- **Python**: 3.8+ (для импорта данных)
- **ОС**: Windows/macOS/Linux

## 🔧 Установка

### Шаг 1: Подготовка БД

```bash
# 1.1 Подключиться к PostgreSQL
psql -h localhost -U postgres

# 1.2 Создать БД
CREATE DATABASE azs_pult;
\q

# 1.3 Загрузить схему
psql -h localhost -U postgres -d azs_pult -f _data/schema.sql

# 1.4 Добавить тестовых пользователей (см. _data/README.md)
psql -h localhost -U postgres -d azs_pult
-- Скопировать и выполнить SQL из раздела "2. Создание тестовых пользователей"
```

### Шаг 2: Backend подготовка

```bash
cd azs-pult-fullstack/backend

# 2.1 Установить зависимости
npm install

# 2.2 Создать .env файл
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<ваш пароль>
DB_NAME=azs_pult
JWT_SECRET=your_jwt_secret_key_change_this
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
EOF

# 2.3 Загрузить данные (опционально, для полного датасета)
python import_data.py
```

### Шаг 3: Frontend подготовка

```bash
cd azs-pult-fullstack/frontend

# 3.1 Установить зависимости
npm install

# 3.2 Создать .env.local файл
cat > .env.local << EOF
VITE_API_URL=http://localhost:3001/api
EOF
```

## 🚀 Запуск системы

### Способ 1: Раздельный запуск (рекомендуется для разработки)

**Терминал 1 - Backend**:
```bash
cd azs-pult-fullstack/backend
npm run dev
# Backend запустится на http://localhost:3001
```

**Терминал 2 - Frontend**:
```bash
cd azs-pult-fullstack/frontend
npm run dev
# Frontend запустится на http://localhost:3000
```

### Способ 2: Production сборка

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

## 📝 Первые шаги

### 1. Проверка API

```bash
# Проверить, что backend работает
curl http://localhost:3001/api/health

# Ожидаемый результат:
# {"status":"ok"}
```

### 2. Вход в систему

Откройте http://localhost:3000 в браузере.

**Тестовые учетные данные**:
- **admin** / `Admin123456` (полный доступ)
- **manager** / `Manager123456` (управление АЗС и ценами)
- **analyst** / `Analyst123456` (аналитика и рекомендации)
- **viewer** / `Viewer123456` (только просмотр)

### 3. Импорт данных (опционально)

Если вы пропустили шаг 2.3:

```bash
cd backend
python import_data.py
```

Скрипт загрузит все CSV файлы из папки `_data` в БД.

## 📁 Структура проекта

```
azs-pult-fullstack/
├── backend/
│   ├── src/
│   │   ├── controllers/      # API endpoints
│   │   ├── services/         # Business logic
│   │   ├── repositories/     # Data access
│   │   ├── middleware/       # Authentication, validation
│   │   ├── database/         # DB initialization
│   │   └── server.ts         # Express app
│   ├── .env                  # Environment variables
│   ├── package.json
│   ├── tsconfig.json
│   └── import_data.py        # CSV import script
│
├── frontend/
│   ├── src/
│   │   ├── components/       # Vue components
│   │   ├── stores/           # Pinia stores
│   │   ├── api/              # API client
│   │   ├── views/            # Page components
│   │   └── App.vue
│   ├── .env.local            # Environment variables
│   ├── package.json
│   └── vite.config.js
│
├── _data/
│   ├── schema.sql            # Database schema
│   ├── README.md             # Data documentation
│   ├── stations.csv          # Station data
│   ├── prices.csv            # Fuel prices & sales
│   ├── weather_data.csv      # Weather data
│   ├── competitor_prices.csv # Competitor prices
│   └── promotions.csv        # Promotions
│
├── SETUP.md                  # This file
└── README.md                 # Project overview
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/logout` - Выход

### AZS (Stations)
- `GET /api/azs` - Список всех станций
- `GET /api/azs/:id` - Детали станции
- `POST /api/azs` - Создать станцию (только admin)
- `PUT /api/azs/:id` - Обновить станцию (только admin)

### Prices
- `GET /api/prices` - Текущие цены
- `GET /api/prices/:azsId` - Цены конкретной станции
- `PUT /api/prices` - Обновить цены
- `GET /api/price-history` - История изменения цен

### Recommendations
- `GET /api/recommendations` - Список рекомендаций
- `POST /api/recommendations/generate` - Генерировать рекомендации
- `PUT /api/recommendations/:id` - Обновить рекомендацию

### Analytics
- `GET /api/analytics/dashboard` - Главная панель
- `GET /api/analytics/revenue` - Анализ выручки
- `GET /api/analytics/competitors` - Анализ конкуренции

### Admin
- `GET /api/admin/users` - Список пользователей
- `POST /api/admin/users` - Создать пользователя
- `PUT /api/admin/users/:id` - Обновить пользователя
- `DELETE /api/admin/users/:id` - Удалить пользователя
- `POST /api/admin/import` - Импортировать данные

## 🐛 Troubleshooting

### Backend не запускается

```bash
# Проверить Node.js
node -v

# Переустановить зависимости
rm -rf node_modules package-lock.json
npm install

# Проверить .env файл
cat .env

# Проверить БД
psql -h localhost -U postgres -d azs_pult -c "SELECT COUNT(*) FROM azs;"
```

### Frontend не подключается к API

```bash
# Проверить .env.local
cat frontend/.env.local

# Проверить, что backend запущен
curl http://localhost:3001/api/health

# Очистить кэш браузера
# Ctrl+Shift+Delete → Cookies and cached images and files → All time
```

### БД не работает

```bash
# Проверить, что PostgreSQL работает
psql -h localhost -U postgres -c "SELECT version();"

# Проверить существование БД
psql -h localhost -U postgres -l | grep azs_pult

# Переинициализировать БД
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS azs_pult;"
psql -h localhost -U postgres -c "CREATE DATABASE azs_pult;"
psql -h localhost -U postgres -d azs_pult -f _data/schema.sql
```

### Ошибка импорта данных

```bash
# Проверить, что файлы существуют
ls -la _data/*.csv

# Проверить кодировку
file _data/stations.csv

# Запустить импорт с verbose выводом
python -u import_data.py
```

## 📊 Проверка работоспособности

### 1. API Health Check
```bash
curl http://localhost:3001/api/health
# Ожидается: {"status":"ok"}
```

### 2. Database Check
```bash
psql -h localhost -U postgres -d azs_pult -c "
  SELECT 'Users' as table_name, COUNT(*) FROM users
  UNION ALL SELECT 'AZS', COUNT(*) FROM azs
  UNION ALL SELECT 'Prices', COUNT(*) FROM prices
  UNION ALL SELECT 'Recommendations', COUNT(*) FROM recommendations;"
```

### 3. Frontend Check
Откройте http://localhost:3000 и проверьте:
- ✓ Страница входа загружается
- ✓ Можете войти с admin/Admin123456
- ✓ Видите главную панель
- ✓ Можете просматривать данные

### 4. API Test
```bash
# Получить список АЗС
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/azs

# Получить текущие цены
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/prices
```

## 🔒 Security

### В production обязательно:

1. **Изменить JWT_SECRET**:
   ```bash
   # Генерировать сильный ключ
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Использовать HTTPS**:
   ```bash
   # Получить SSL сертификат (Let's Encrypt)
   # https://letsencrypt.org/
   ```

3. **Настроить CORS**:
   ```javascript
   // backend/src/server.ts
   app.use(cors({
     origin: 'https://yourdomain.com',
     credentials: true
   }));
   ```

4. **Включить rate limiting**:
   ```bash
   npm install express-rate-limit
   ```

5. **Обновить пароли пользователей**:
   ```sql
   -- Используйте bcryptjs для хеширования
   UPDATE users SET password_hash = 'новый_хеш' WHERE username = 'admin';
   ```

## 📚 Дополнительные ресурсы

- **Документация БД**: [_data/README.md](_data/README.md)
- **API Documentation**: [backend/API.md](backend/API.md) (если создан)
- **Frontend Components**: [frontend/src/components/](frontend/src/components/)
- **Database Queries**: [_data/README.md#запросы-для-аналитики](_data/README.md#запросы-для-аналитики)

## 🤝 Поддержка

Если возникли проблемы:

1. Проверьте логи:
   ```bash
   # Backend логи
   cd backend && npm run dev

   # Frontend логи
   cd frontend && npm run dev
   # и откройте браузерную консоль (F12)
   ```

2. Проверьте БД:
   ```bash
   psql -h localhost -U postgres -d azs_pult
   \dt  # список таблиц
   ```

3. Проверьте сетевую доступность:
   ```bash
   # Проверить, что backend доступен
   curl -v http://localhost:3001/api/health
   
   # Проверить CORS
   curl -v -H "Origin: http://localhost:3000" http://localhost:3001/api/health
   ```

---

**Версия**: 2.1.0  
**Последнее обновление**: 08.10.2026
