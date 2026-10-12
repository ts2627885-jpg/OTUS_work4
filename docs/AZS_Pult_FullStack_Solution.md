# 🔐 Full-Stack Solution: Authentication, Roles, PostgreSQL, Docker

## 1. **Архитектура приложения с Auth**

```
azs-pult/
├── backend/
│   ├── server.js
│   ├── config/
│   │   ├── database.js
│   │   └── auth.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── rbac.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── azs.js
│   │   ├── recommendations.js
│   │   └── admin.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Role.js
│   │   ├── AZS.js
│   │   └── Recommendation.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── csv-import.service.js
│   │   └── engine.service.js
│   └── migrations/
│       ├── 001_init_users.sql
│       ├── 002_init_azs.sql
│       └── 003_init_recommendations.sql
├── frontend/
│   ├── src/
│   │   ├── store/auth.js
│   │   ├── components/Login.vue
│   │   ├── middleware/requireAuth.js
│   │   └── utils/api.js
│   └── package.json
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## 2. **PostgreSQL схема данных**

### 2.1 Миграция БД

```sql
-- migrations/001_init_users.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Роли и права доступа
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  resource VARCHAR(50),    -- 'azs', 'recommendations', 'admin'
  action VARCHAR(50)       -- 'read', 'write', 'delete', 'admin'
);

CREATE TABLE role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- Пользователи
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  role_id INTEGER REFERENCES roles(id),
  
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Логи входов
CREATE TABLE login_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20),  -- 'success', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);

-- АЗС (заправочные станции)
CREATE TABLE azs (
  id SERIAL PRIMARY KEY,
  
  external_id VARCHAR(50),  -- ID из исходных данных
  name VARCHAR(255) NOT NULL,
  location_region VARCHAR(100),
  
  owner_id UUID REFERENCES users(id),  -- Менеджер АЗС
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Права на просмотр АЗС (granular access)
CREATE TABLE azs_access (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  access_level VARCHAR(20),  -- 'view', 'edit', 'admin'
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, azs_id)
);

-- Топливо (ежедневные данные)
CREATE TABLE fuel_sales (
  id BIGSERIAL PRIMARY KEY,
  
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(20),     -- 'AI-95', 'DT', 'AI-92'
  date DATE NOT NULL,
  
  volume_liters DECIMAL(12, 2),
  price_per_liter DECIMAL(8, 2),
  revenue DECIMAL(12, 2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(azs_id, fuel_type, date)
);

CREATE INDEX idx_fuel_sales_azs_date ON fuel_sales(azs_id, date);
CREATE INDEX idx_fuel_sales_date ON fuel_sales(date);

-- Трафик
CREATE TABLE traffic (
  id BIGSERIAL PRIMARY KEY,
  
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  vehicle_count INTEGER,
  truck_count INTEGER,
  truck_percentage DECIMAL(5, 2),
  liters_per_vehicle DECIMAL(8, 2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(azs_id, date)
);

-- Цены конкурентов
CREATE TABLE competitor_prices (
  id BIGSERIAL PRIMARY KEY,
  
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  competitor_name VARCHAR(100),
  fuel_type VARCHAR(20),
  date DATE NOT NULL,
  
  price_per_liter DECIMAL(8, 2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(azs_id, competitor_name, fuel_type, date)
);

-- Погода
CREATE TABLE weather (
  id BIGSERIAL PRIMARY KEY,
  
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  temperature_avg DECIMAL(5, 2),
  temperature_min DECIMAL(5, 2),
  temperature_max DECIMAL(5, 2),
  precipitation DECIMAL(8, 2),
  conditions VARCHAR(50),    -- 'sunny', 'rainy', 'foggy'
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(azs_id, date)
);

-- Рекомендации
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  
  rule_id VARCHAR(50),       -- PRICE-001, TRAFFIC-001
  rule_version VARCHAR(20),
  
  category VARCHAR(50),      -- 'pricing', 'traffic', 'promotion'
  priority VARCHAR(20),      -- 'urgent', 'high', 'medium', 'low'
  
  title TEXT,
  description TEXT,
  action_recommended TEXT,
  
  potential_effect_rub DECIMAL(10, 2),
  potential_effect_percent DECIMAL(6, 2),
  
  calculation_formula TEXT,   -- JSON с формулой
  
  status VARCHAR(20),        -- 'active', 'completed', 'ignored'
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recommendations_azs ON recommendations(azs_id, status);
CREATE INDEX idx_recommendations_priority ON recommendations(priority);

-- Версионирование данных (для аудита)
CREATE TABLE data_imports (
  id SERIAL PRIMARY KEY,
  
  imported_by UUID REFERENCES users(id),
  
  file_name VARCHAR(255),
  file_type VARCHAR(20),     -- 'fuel_sales', 'traffic', 'weather'
  
  rows_imported INTEGER,
  rows_failed INTEGER,
  
  import_date DATE,
  date_range_start DATE,
  date_range_end DATE,
  
  status VARCHAR(20),        -- 'success', 'partial', 'failed'
  error_log TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Вставить стандартные роли и права
INSERT INTO roles (name, description) VALUES
  ('admin', 'Администратор системы'),
  ('manager', 'Менеджер АЗС'),
  ('analyst', 'Аналитик'),
  ('viewer', 'Только чтение');

INSERT INTO permissions (name, description, resource, action) VALUES
  ('azs_view_all', 'Просмотр всех АЗС', 'azs', 'read'),
  ('azs_view_own', 'Просмотр только своих АЗС', 'azs', 'read'),
  ('azs_edit', 'Редактирование АЗС', 'azs', 'write'),
  ('azs_delete', 'Удаление АЗС', 'azs', 'delete'),
  ('recommendations_view', 'Просмотр рекомендаций', 'recommendations', 'read'),
  ('recommendations_complete', 'Отметить рекомендацию как выполненную', 'recommendations', 'write'),
  ('data_import', 'Загрузка CSV файлов', 'admin', 'write'),
  ('users_manage', 'Управление пользователями', 'admin', 'admin'),
  ('settings', 'Управление настройками', 'admin', 'admin');

-- Admin роль получает все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin';

-- Manager роль
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'manager' AND p.name IN ('azs_view_own', 'recommendations_view', 'recommendations_complete');

-- Analyst роль
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'analyst' AND p.name IN ('azs_view_all', 'recommendations_view');

-- Viewer роль
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'viewer' AND p.name IN ('azs_view_all', 'recommendations_view');
```

---

## 3. **Backend: Node.js + Express + PostgreSQL**

### 3.1 Установка зависимостей

```bash
npm install express pg bcryptjs jsonwebtoken dotenv cors helmet express-validator multer
npm install -D nodemon jest supertest
```

### 3.2 Конфигурация БД

```javascript
// backend/config/database.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'azs_pult',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => console.error('Pool error:', err));

module.exports = pool;
```

### 3.3 Сервис аутентификации

```javascript
// backend/services/auth.service.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

class AuthService {
  async register(username, email, password, roleId = 4) { // 4 = viewer по умолчанию
    try {
      // Проверить, не существует ли пользователь
      const exists = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );
      
      if (exists.rows.length > 0) {
        throw new Error('User already exists');
      }
      
      // Хеш пароля
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Создать пользователя
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, role_id`,
        [username, email, hashedPassword, roleId]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
  
  async login(username, password) {
    try {
      // Найти пользователя
      const result = await pool.query(
        `SELECT u.*, r.name as role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.username = $1 AND u.is_active = TRUE`,
        [username]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }
      
      const user = result.rows[0];
      
      // Проверить пароль
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        throw new Error('Invalid credentials');
      }
      
      // Получить права доступа
      const perms = await pool.query(
        `SELECT p.name FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = $1`,
        [user.role_id]
      );
      
      // Записать логин
      await pool.query(
        `UPDATE users SET last_login = NOW() WHERE id = $1`,
        [user.id]
      );
      
      // Создать JWT
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role_name,
          permissions: perms.rows.map(p => p.name)
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role_name
        }
      };
    } catch (error) {
      throw error;
    }
  }
  
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

module.exports = new AuthService();
```

### 3.4 Middleware для auth и RBAC

```javascript
// backend/middleware/auth.js
const authService = require('../services/auth.service');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticateToken };
```

```javascript
// backend/middleware/rbac.js
const pool = require('../config/database');

const authorize = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      const userPermissions = req.user.permissions || [];
      
      const hasPermission = requiredPermissions.some(perm => 
        userPermissions.includes(perm)
      );
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredPermissions
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization error' });
    }
  };
};

module.exports = { authorize };
```

### 3.5 API маршруты

```javascript
// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { body, validationResult } = require('express-validator');

router.post('/register',
  [
    body('username').isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const user = await authService.register(
        req.body.username,
        req.body.email,
        req.body.password
      );
      res.status(201).json({ user });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.post('/login', async (req, res) => {
  try {
    const result = await authService.login(req.body.username, req.body.password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

module.exports = router;
```

```javascript
// backend/routes/azs.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Получить АЗС (с учётом прав доступа)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT a.* FROM azs a
      WHERE 1=1
    `;
    const params = [];
    
    // Если не админ и не аналитик, только свои АЗС
    if (!req.user.permissions.includes('azs_view_all')) {
      query += ` AND a.id IN (
        SELECT azs_id FROM azs_access WHERE user_id = $1
      )`;
      params.push(req.user.userId);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить данные по АЗС
router.get('/:azsId/data', authenticateToken, async (req, res) => {
  try {
    const { azsId } = req.params;
    const { window = 28 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        fs.date,
        fs.fuel_type,
        fs.volume_liters,
        fs.price_per_liter,
        fs.revenue,
        t.vehicle_count,
        t.liters_per_vehicle,
        w.temperature_avg,
        w.precipitation
      FROM fuel_sales fs
      LEFT JOIN traffic t ON fs.azs_id = t.azs_id AND fs.date = t.date
      LEFT JOIN weather w ON fs.azs_id = w.azs_id AND fs.date = w.date
      WHERE fs.azs_id = $1 AND fs.date >= NOW()::DATE - $2::INTEGER
      ORDER BY fs.date DESC
    `, [azsId, window]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### 3.6 Сервис импорта CSV

```javascript
// backend/services/csv-import.service.js
const fs = require('fs');
const csv = require('csv-parser');
const pool = require('../config/database');

class CSVImportService {
  async importFuelSales(filePath, importedBy) {
    const rows = [];
    let failedRows = 0;
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rows.push({
            azs_id: row.azs_id,
            fuel_type: row.fuel_type,
            date: row.date,
            volume_liters: parseFloat(row.volume_liters),
            price_per_liter: parseFloat(row.price_per_liter),
            revenue: parseFloat(row.revenue)
          });
        })
        .on('end', async () => {
          try {
            const client = await pool.connect();
            
            try {
              await client.query('BEGIN');
              
              for (const row of rows) {
                try {
                  await client.query(
                    `INSERT INTO fuel_sales 
                     (azs_id, fuel_type, date, volume_liters, price_per_liter, revenue)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (azs_id, fuel_type, date) 
                     DO UPDATE SET volume_liters = $4, price_per_liter = $5, revenue = $6`,
                    [row.azs_id, row.fuel_type, row.date, row.volume_liters, row.price_per_liter, row.revenue]
                  );
                } catch (err) {
                  failedRows++;
                }
              }
              
              // Записать в логи импорта
              await client.query(
                `INSERT INTO data_imports 
                 (imported_by, file_name, file_type, rows_imported, rows_failed, status)
                 VALUES ($1, $2, 'fuel_sales', $3, $4, $5)`,
                [importedBy, filePath.split('/').pop(), rows.length - failedRows, failedRows, 
                 failedRows === 0 ? 'success' : 'partial']
              );
              
              await client.query('COMMIT');
              
              resolve({
                imported: rows.length - failedRows,
                failed: failedRows,
                status: failedRows === 0 ? 'success' : 'partial'
              });
            } catch (err) {
              await client.query('ROLLBACK');
              reject(err);
            } finally {
              client.release();
            }
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject);
    });
  }
}

module.exports = new CSVImportService();
```

### 3.7 Главный сервер

```javascript
// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const azsRoutes = require('./routes/azs');
const adminRoutes = require('./routes/admin');
const { authenticateToken } = require('./middleware/auth');

const app = express();

// Middleware безопасности
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Роуты
app.use('/api/auth', authRoutes);
app.use('/api/azs', authenticateToken, azsRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 4. **Docker + Docker Compose**

### 4.1 Dockerfile (Backend)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Копировать package.json
COPY package*.json ./

# Установить зависимости
RUN npm ci --only=production

# Копировать код
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "server.js"]
```

### 4.2 docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL база данных
  postgres:
    image: postgres:16-alpine
    container_name: azs-pult-db
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-azs_pult}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - azs-network

  # Backend Node.js приложение
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: azs-pult-backend
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ${DB_USER:-postgres}
      DB_PASSWORD: ${DB_PASSWORD:-postgres}
      DB_NAME: ${DB_NAME:-azs_pult}
      JWT_SECRET: ${JWT_SECRET:-your-secret-key-change-me}
      FRONTEND_URL: http://localhost:3000
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - /app/node_modules
      - uploads:/app/uploads
    networks:
      - azs-network
    restart: unless-stopped

  # Frontend (Vue.js)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: azs-pult-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    environment:
      VITE_API_URL: http://localhost:3001/api
    networks:
      - azs-network
    restart: unless-stopped

  # Redis для кэширования и сессий (опционально)
  redis:
    image: redis:7-alpine
    container_name: azs-pult-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - azs-network
    restart: unless-stopped

  # PgAdmin для управления БД (опционально, для разработки)
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: azs-pult-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - azs-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  uploads:

networks:
  azs-network:
    driver: bridge
```

### 4.3 .env файл

```bash
# .env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=azs_admin
DB_PASSWORD=secure-password-here
DB_NAME=azs_pult

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Redis
REDIS_URL=redis://redis:6379

# App
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

---

## 5. **Frontend: Логин и контроль прав**

### 5.1 Компонент логина (Vue 3)

```vue
<!-- frontend/src/components/Login.vue -->
<template>
  <div class="login-container">
    <div class="login-card">
      <h1>АЗС-Пульт</h1>
      <p class="subtitle">Система управления ценовой политикой</p>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">Пользователь</label>
          <input
            v-model="form.username"
            type="text"
            id="username"
            placeholder="Введите имя пользователя"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="password">Пароль</label>
          <input
            v-model="form.password"
            type="password"
            id="password"
            placeholder="Введите пароль"
            required
          />
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        
        <button type="submit" class="btn-login" :disabled="loading">
          {{ loading ? 'Загрузка...' : 'Вход' }}
        </button>
      </form>
      
      <p class="register-link">
        Нет аккаунта? <a href="#" @click="showRegister = true">Зарегистрируйтесь</a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  username: '',
  password: ''
});

const loading = ref(false);
const error = ref('');
const showRegister = ref(false);

const handleLogin = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
    
    if (!response.ok) {
      throw new Error('Неверные учётные данные');
    }
    
    const data = await response.json();
    
    // Сохранить в store
    authStore.setAuth(data.token, data.user);
    
    // Перейти на главную
    router.push('/dashboard');
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #0E5A7A 0%, #1a3a4a 100%);
}

.login-card {
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

h1 {
  color: #0E5A7A;
  text-align: center;
  margin-bottom: 10px;
  font-size: 2em;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: #0E5A7A;
  box-shadow: 0 0 0 3px rgba(14, 90, 122, 0.1);
}

.btn-login {
  width: 100%;
  padding: 12px;
  background: #0E5A7A;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-login:hover:not(:disabled) {
  background: #0a4257;
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #d32f2f;
  padding: 12px;
  background: #ffebee;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 0.9em;
}

.register-link {
  text-align: center;
  margin-top: 20px;
  color: #666;
}

.register-link a {
  color: #0E5A7A;
  text-decoration: none;
  font-weight: 600;
}

.register-link a:hover {
  text-decoration: underline;
}
</style>
```

### 5.2 Auth Store (Pinia)

```javascript
// frontend/src/store/auth.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null);
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));
  const permissions = ref([]);
  
  const isAuthenticated = computed(() => !!token.value);
  const userRole = computed(() => user.value?.role);
  
  const setAuth = (newToken, newUser) => {
    token.value = newToken;
    user.value = newUser;
    permissions.value = newUser.permissions || [];
    
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };
  
  const logout = () => {
    token.value = null;
    user.value = null;
    permissions.value = [];
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };
  
  const hasPermission = (permission) => {
    return permissions.value.includes(permission);
  };
  
  const hasRole = (role) => {
    return userRole.value === role;
  };
  
  return {
    token,
    user,
    permissions,
    isAuthenticated,
    userRole,
    setAuth,
    logout,
    hasPermission,
    hasRole
  };
});
```

### 5.3 Route Guards

```javascript
// frontend/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/store/auth';

import Login from '@/components/Login.vue';
import Dashboard from '@/components/Dashboard.vue';
import AdminPanel from '@/components/AdminPanel.vue';

const routes = [
  {
    path: '/login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, requiredPermission: 'azs_view_all' }
  },
  {
    path: '/admin',
    component: AdminPanel,
    meta: { requiresAuth: true, requiredPermission: 'users_manage' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.meta.requiresAuth !== false;
  const requiredPermission = to.meta.requiredPermission;
  
  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login');
    return;
  }
  
  if (requiredPermission && !authStore.hasPermission(requiredPermission)) {
    next('/403');
    return;
  }
  
  if (to.path === '/login' && authStore.isAuthenticated) {
    next('/dashboard');
    return;
  }
  
  next();
});

export default router;
```

### 5.4 API с автоматической авторизацией

```javascript
// frontend/src/utils/api.js
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'vue-router';

class APIClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }
  
  async request(endpoint, options = {}) {
    const authStore = useAuthStore();
    const router = useRouter();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers
      });
      
      if (response.status === 401) {
        authStore.logout();
        router.push('/login');
        throw new Error('Unauthorized');
      }
      
      if (response.status === 403) {
        router.push('/403');
        throw new Error('Forbidden');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
  
  get(endpoint, options) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }
  
  post(endpoint, data, options) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  put(endpoint, data, options) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}

export default new APIClient();
```

---

## 6. **Запуск приложения**

### 6.1 Инициализация и запуск

```bash
# Клонировать репо
git clone https://github.com/your/azs-pult.git
cd azs-pult

# Скопировать .env
cp .env.example .env

# Запустить с Docker
docker-compose up -d

# Ждём, пока БД инициализируется
sleep 10

# Миграции (если нужны дополнительные)
docker-compose exec backend npm run migrate

# Проверить статус
docker-compose ps
```

### 6.2 Создать первого админа

```bash
docker-compose exec backend node -e "
const authService = require('./services/auth.service');
authService.register('admin', 'admin@example.com', 'SecurePassword123', 1)
  .then(() => console.log('Admin created'))
  .catch(err => console.error(err));
"
```

### 6.3 Доступы

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api
- **PgAdmin:** http://localhost:5050 (admin@example.com / admin)

---

## 7. **Импорт CSV файлов через веб-интерфейс**

```vue
<!-- frontend/src/components/DataImport.vue -->
<template>
  <div class="import-panel">
    <h2>Загрузка данных</h2>
    
    <form @submit.prevent="handleImport">
      <div class="form-group">
        <label>Выберите тип данных</label>
        <select v-model="fileType" required>
          <option value="">-- Выберите --</option>
          <option value="fuel_sales">Продажи топлива</option>
          <option value="traffic">Трафик</option>
          <option value="weather">Погода</option>
          <option value="competitors">Цены конкурентов</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>CSV файл</label>
        <input
          type="file"
          accept=".csv"
          @change="handleFileSelect"
          required
        />
      </div>
      
      <button type="submit" :disabled="!file || loading">
        {{ loading ? 'Загрузка...' : 'Загрузить' }}
      </button>
    </form>
    
    <div v-if="progress" class="progress">
      <div class="bar" :style="{ width: progress + '%' }"></div>
    </div>
    
    <div v-if="result" class="result" :class="result.status">
      <p>Загружено: {{ result.imported }}</p>
      <p v-if="result.failed > 0">Ошибок: {{ result.failed }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import api from '@/utils/api';

const fileType = ref('');
const file = ref(null);
const loading = ref(false);
const progress = ref(0);
const result = ref(null);

const handleFileSelect = (e) => {
  file.value = e.target.files[0];
};

const handleImport = async () => {
  loading.value = true;
  progress.value = 0;
  result.value = null;
  
  try {
    const formData = new FormData();
    formData.append('file', file.value);
    formData.append('type', fileType.value);
    
    const response = await fetch('/api/admin/import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });
    
    const data = await response.json();
    result.value = data;
  } catch (error) {
    result.value = { status: 'error', message: error.message };
  } finally {
    loading.value = false;
  }
};
</script>
```

---

## 📊 Матрица доступа по ролям

| Функция | Admin | Manager | Analyst | Viewer |
|---|---|---|---|---|
| Просмотр всех АЗС | ✅ | ❌ (только свои) | ✅ | ✅ |
| Редактирование АЗС | ✅ | ✅ (свои) | ❌ | ❌ |
| Просмотр рекомендаций | ✅ | ✅ | ✅ | ✅ |
| Отметить выполненной | ✅ | ✅ | ❌ | ❌ |
| Загрузка CSV | ✅ | ❌ | ❌ | ❌ |
| Управление пользователями | ✅ | ❌ | ❌ | ❌ |
| Настройки системы | ✅ | ❌ | ❌ | ❌ |

---

## 🚀 Итоговая архитектура

```
┌─────────────────┐
│  Frontend (Vue3)│
│  - Login        │
│  - Dashboard    │
│  - Admin Panel  │
└────────┬────────┘
         │ HTTP/HTTPS
         ▼
┌─────────────────┐
│  Backend (Node) │
│  - Express API  │
│  - JWT Auth     │
│  - RBAC Middlw. │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌─────┐
│ PosSQL │  │Redis│
│  (БД)  │  │Cache│
└────────┘  └─────┘

🐳 Docker Compose управляет всеми контейнерами
```

---

## ✅ Выигрыши архитектуры

- ✅ **Безопасная аутентификация** (JWT + bcrypt)
- ✅ **Контроль прав доступа** (RBAC)
- ✅ **Масштабируемость** (легко добавить новых пользователей/АЗС)
- ✅ **Аудит** (логи всех действий)
- ✅ **Легкое развёртывание** (Docker)
- ✅ **Интеграция внешних систем** (REST API)
- ✅ **Импорт данных** (CSV в БД)
- ✅ **Управление данными** (PostgreSQL с индексами)
- ✅ **Кэширование** (Redis для сессий и кэша)

---

## 🔒 Рекомендации по безопасности

1. **Измени JWT_SECRET** в production на сильный ключ (32+ символа)
2. **Используй HTTPS** в production
3. **Настрой CORS** только на доверенные домены
4. **Регулярно обновляй зависимости**: `npm audit fix`
5. **Добавь rate limiting** на API endpoints
6. **Логируй все действия** для аудита
7. **Регулярно делай backup БД**
8. **Используй environment variables** для секретов

