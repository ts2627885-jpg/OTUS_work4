-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AZS Stations table
CREATE TABLE IF NOT EXISTS azs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  region VARCHAR(255) NOT NULL,
  fuel_types TEXT[] NOT NULL,
  manager VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prices table
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  trend VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  fuel_type VARCHAR(50) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  recommended_price DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  confidence DECIMAL(5, 2),
  estimated_revenue DECIMAL(12, 2),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Тестовые пользователи не создаются этим файлом: их создаёт backend/seed_users.py
-- с паролями из переменных окружения (ADMIN_PASSWORD и др.). Хешей паролей в репозитории нет.

-- Демо-станции удалены: станции загружаются из данных (см. _BD/pipeline)



-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prices_azs_id ON prices(azs_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_azs_id ON recommendations(azs_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
