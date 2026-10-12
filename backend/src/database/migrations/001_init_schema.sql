/**
 * Database Schema Initialization
 * Creates all required tables with proper constraints and indexes
 *
 * Execution:
 * psql -U postgres -d azs_pult -f 001_init_schema.sql
 */

-- ============================================
-- ROLES & PERMISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO roles (id, name, description) VALUES
  (1, 'admin', 'System administrator with full access'),
  (2, 'manager', 'Station manager who can modify prices and manage AZS'),
  (3, 'analyst', 'Data analyst who can view recommendations and reports'),
  (4, 'viewer', 'Read-only access to public data')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- ============================================
-- USERS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ============================================
-- GAS STATIONS (АЗС)
-- ============================================

CREATE TABLE IF NOT EXISTS azs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  location_city VARCHAR(100) NOT NULL,
  location_region VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_azs_manager_id ON azs(manager_id);
CREATE INDEX idx_azs_location_city ON azs(location_city);
CREATE INDEX idx_azs_location_region ON azs(location_region);
CREATE INDEX idx_azs_is_active ON azs(is_active);
CREATE INDEX idx_azs_location ON azs(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================
-- FUEL PRICES
-- ============================================

CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(20) NOT NULL CHECK (fuel_type IN ('AI-92', 'AI-95', 'AI-98', 'Diesel')),
  price DECIMAL(8, 2) NOT NULL CHECK (price > 0),
  cost DECIMAL(8, 2) NOT NULL CHECK (cost > 0),
  margin DECIMAL(8, 2),
  margin_percent DECIMAL(5, 2),
  effective_from TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prices_azs_id ON prices(azs_id);
CREATE INDEX idx_prices_fuel_type ON prices(fuel_type);
CREATE INDEX idx_prices_effective_from ON prices(effective_from);
CREATE INDEX idx_prices_azs_fuel ON prices(azs_id, fuel_type);

-- ============================================
-- PRICE HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_id UUID NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(20) NOT NULL,
  price DECIMAL(8, 2) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_price_history_price_id ON price_history(price_id);
CREATE INDEX idx_price_history_azs_id ON price_history(azs_id);
CREATE INDEX idx_price_history_changed_at ON price_history(changed_at);
CREATE INDEX idx_price_history_changed_by ON price_history(changed_by);

-- ============================================
-- RECOMMENDATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(20) NOT NULL,
  current_price DECIMAL(8, 2) NOT NULL,
  recommended_price DECIMAL(8, 2) NOT NULL,
  confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
  reason TEXT,
  elasticity DECIMAL(6, 3),
  competitor_avg DECIMAL(8, 2),
  estimated_revenue_impact DECIMAL(12, 2),
  estimated_volume_impact DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMP
);

CREATE INDEX idx_recommendations_azs_id ON recommendations(azs_id);
CREATE INDEX idx_recommendations_created_at ON recommendations(created_at);
CREATE INDEX idx_recommendations_expires_at ON recommendations(expires_at);
CREATE INDEX idx_recommendations_is_applied ON recommendations(is_applied);

-- ============================================
-- SALES & TRAFFIC DATA
-- ============================================

CREATE TABLE IF NOT EXISTS sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(20) NOT NULL,
  quantity DECIMAL(12, 2) NOT NULL,
  revenue DECIMAL(12, 2) NOT NULL,
  period_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sales_data_azs_id ON sales_data(azs_id);
CREATE INDEX idx_sales_data_period_date ON sales_data(period_date);
CREATE INDEX idx_sales_data_azs_date ON sales_data(azs_id, period_date);

CREATE TABLE IF NOT EXISTS traffic_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  visitors_count INTEGER NOT NULL,
  unique_customers INTEGER,
  avg_check DECIMAL(8, 2),
  period_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_traffic_data_azs_id ON traffic_data(azs_id);
CREATE INDEX idx_traffic_data_period_date ON traffic_data(period_date);

-- ============================================
-- COMPETITOR PRICES
-- ============================================

CREATE TABLE IF NOT EXISTS competitor_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  competitor_name VARCHAR(200) NOT NULL,
  fuel_type VARCHAR(20) NOT NULL,
  price DECIMAL(8, 2) NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_competitor_prices_azs_id ON competitor_prices(azs_id);
CREATE INDEX idx_competitor_prices_fuel_type ON competitor_prices(fuel_type);
CREATE INDEX idx_competitor_prices_last_updated ON competitor_prices(last_updated);

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- APPLICATION LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS app_logs (
  id BIGSERIAL PRIMARY KEY,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  context VARCHAR(100),
  metadata JSONB,
  stack_trace TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_app_logs_level ON app_logs(level);
CREATE INDEX idx_app_logs_context ON app_logs(context);
CREATE INDEX idx_app_logs_created_at ON app_logs(created_at DESC);

-- ============================================
-- AZS ACCESS CONTROL
-- ============================================

CREATE TABLE IF NOT EXISTS azs_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  granted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, azs_id)
);

CREATE INDEX idx_azs_access_user_id ON azs_access(user_id);
CREATE INDEX idx_azs_access_azs_id ON azs_access(azs_id);
