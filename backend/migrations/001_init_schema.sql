-- Initialize database schema for АЗС-Пульт

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  resource VARCHAR(50),
  action VARCHAR(50)
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
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

-- Login logs
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- АЗС (Gas Stations)
CREATE TABLE IF NOT EXISTS azs (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  location_city VARCHAR(100),
  location_region VARCHAR(100),
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- АЗС Access control
CREATE TABLE IF NOT EXISTS azs_access (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  access_level VARCHAR(20),
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, azs_id)
);

-- Fuel sales
CREATE TABLE IF NOT EXISTS fuel_sales (
  id BIGSERIAL PRIMARY KEY,
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(20),
  date DATE NOT NULL,
  volume_liters DECIMAL(12, 2),
  price_per_liter DECIMAL(8, 2),
  revenue DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(azs_id, fuel_type, date)
);

CREATE INDEX IF NOT EXISTS idx_fuel_sales_azs_date ON fuel_sales(azs_id, date);
CREATE INDEX IF NOT EXISTS idx_fuel_sales_date ON fuel_sales(date);

-- Traffic
CREATE TABLE IF NOT EXISTS traffic (
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

-- Competitor prices
CREATE TABLE IF NOT EXISTS competitor_prices (
  id BIGSERIAL PRIMARY KEY,
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  competitor_name VARCHAR(100),
  fuel_type VARCHAR(20),
  date DATE NOT NULL,
  price_per_liter DECIMAL(8, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(azs_id, competitor_name, fuel_type, date)
);

-- Weather
CREATE TABLE IF NOT EXISTS weather (
  id BIGSERIAL PRIMARY KEY,
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  temperature_avg DECIMAL(5, 2),
  temperature_min DECIMAL(5, 2),
  temperature_max DECIMAL(5, 2),
  precipitation DECIMAL(8, 2),
  conditions VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(azs_id, date)
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  azs_id INTEGER REFERENCES azs(id) ON DELETE CASCADE,
  rule_id VARCHAR(50),
  rule_version VARCHAR(20),
  category VARCHAR(50),
  priority VARCHAR(20),
  title TEXT,
  description TEXT,
  action_recommended TEXT,
  potential_effect_rub DECIMAL(10, 2),
  potential_effect_percent DECIMAL(6, 2),
  calculation_formula TEXT,
  status VARCHAR(20) DEFAULT 'active',
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_azs ON recommendations(azs_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority);

-- Data imports log
CREATE TABLE IF NOT EXISTS data_imports (
  id SERIAL PRIMARY KEY,
  imported_by UUID REFERENCES users(id),
  file_name VARCHAR(255),
  file_type VARCHAR(20),
  rows_imported INTEGER,
  rows_failed INTEGER,
  import_date DATE,
  date_range_start DATE,
  date_range_end DATE,
  status VARCHAR(20),
  error_log TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Администратор системы'),
  ('manager', 'Менеджер АЗС'),
  ('analyst', 'Аналитик'),
  ('viewer', 'Только чтение')
ON CONFLICT DO NOTHING;

-- Insert permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('azs_view_all', 'Просмотр всех АЗС', 'azs', 'read'),
  ('azs_view_own', 'Просмотр только своих АЗС', 'azs', 'read'),
  ('azs_edit', 'Редактирование АЗС', 'azs', 'write'),
  ('azs_delete', 'Удаление АЗС', 'azs', 'delete'),
  ('recommendations_view', 'Просмотр рекомендаций', 'recommendations', 'read'),
  ('recommendations_complete', 'Отметить рекомендацию как выполненную', 'recommendations', 'write'),
  ('data_import', 'Загрузка CSV файлов', 'admin', 'write'),
  ('users_manage', 'Управление пользователями', 'admin', 'admin'),
  ('settings', 'Управление настройками', 'admin', 'admin')
ON CONFLICT DO NOTHING;

-- Assign permissions to roles
-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role_id = r.id AND permission_id = p.id
)
ON CONFLICT DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager' AND p.name IN ('azs_view_own', 'recommendations_view', 'recommendations_complete')
AND NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role_id = r.id AND permission_id = p.id
)
ON CONFLICT DO NOTHING;

-- Analyst permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'analyst' AND p.name IN ('azs_view_all', 'recommendations_view')
AND NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role_id = r.id AND permission_id = p.id
)
ON CONFLICT DO NOTHING;

-- Viewer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.name IN ('azs_view_all', 'recommendations_view')
AND NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role_id = r.id AND permission_id = p.id
)
ON CONFLICT DO NOTHING;
