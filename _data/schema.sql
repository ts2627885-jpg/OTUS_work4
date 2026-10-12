-- =====================================================
-- АЗС-Пульт v2.1 - Полная схема базы данных
-- =====================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS import_history CASCADE;
DROP TABLE IF EXISTS traffic_data CASCADE;
DROP TABLE IF EXISTS shop_sales CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS competitor_prices CASCADE;
DROP TABLE IF EXISTS weather_data CASCADE;
DROP TABLE IF EXISTS sales_data CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS prices CASCADE;
DROP TABLE IF EXISTS azs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- 1. Users Table
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'analyst', 'viewer')),
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. AZS (Gas Stations) Table
-- =====================================================
CREATE TABLE azs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  region VARCHAR(255) NOT NULL,
  fuel_types TEXT[] NOT NULL,
  manager VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. Prices Table
-- =====================================================
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  trend VARCHAR(50) CHECK (trend IN ('up', 'down', 'stable')),
  previous_price DECIMAL(10, 2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(azs_id, fuel_type)
);

-- =====================================================
-- 4. Price History Table (Audit)
-- =====================================================
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(50) NOT NULL,
  price_from DECIMAL(10, 2) NOT NULL,
  price_to DECIMAL(10, 2) NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255)
);

-- =====================================================
-- 5. Recommendations Table
-- =====================================================
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('price_increase', 'price_decrease', 'hold')),
  fuel_type VARCHAR(50) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  recommended_price DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  confidence DECIMAL(5, 2) CHECK (confidence >= 0 AND confidence <= 100),
  estimated_revenue DECIMAL(12, 2),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'completed', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- =====================================================
-- 6. Sales Data Table
-- =====================================================
CREATE TABLE sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  fuel_type VARCHAR(50) NOT NULL,
  volume DECIMAL(10, 2) NOT NULL,
  revenue DECIMAL(12, 2) NOT NULL,
  date_recorded DATE NOT NULL
);

-- =====================================================
-- 7. Weather Data Table
-- =====================================================
CREATE TABLE weather_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  temperature DECIMAL(5, 2),
  humidity DECIMAL(5, 2),
  wind_speed DECIMAL(5, 2),
  conditions VARCHAR(100),
  date_recorded TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. Competitor Prices Table
-- =====================================================
CREATE TABLE competitor_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255),
  fuel_type VARCHAR(50),
  price DECIMAL(10, 2),
  distance_km DECIMAL(6, 2),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. Audit Logs Table
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  changes TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 10. Import History Table
-- =====================================================
CREATE TABLE import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(255),
  imported_by UUID REFERENCES users(id),
  import_type VARCHAR(50) CHECK (import_type IN ('prices', 'sales', 'weather')),
  record_count INT,
  status VARCHAR(50) CHECK (status IN ('completed', 'failed', 'partial')),
  error_message TEXT,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 11. Promotions Table
-- =====================================================
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  start_date DATE,
  end_date DATE,
  discount DECIMAL(5, 2),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. Shop Sales Table
-- =====================================================
CREATE TABLE shop_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID REFERENCES azs(id) ON DELETE CASCADE,
  shop_name VARCHAR(255),
  product_type VARCHAR(100),
  sales_amount DECIMAL(12, 2),
  revenue DECIMAL(12, 2),
  date_recorded DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 13. Traffic Data Table
-- =====================================================
CREATE TABLE traffic_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azs_id UUID REFERENCES azs(id) ON DELETE CASCADE,
  date_recorded DATE NOT NULL,
  cars INT,
  trucks INT,
  motorcycles INT,
  buses INT,
  total_vehicles INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_prices_azs_id ON prices(azs_id);
CREATE INDEX idx_prices_fuel_type ON prices(fuel_type);
CREATE INDEX idx_prices_updated ON prices(updated_at DESC);

CREATE INDEX idx_recommendations_azs_id ON recommendations(azs_id);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_created ON recommendations(created_at DESC);

CREATE INDEX idx_price_history_azs_id ON price_history(azs_id);
CREATE INDEX idx_price_history_changed ON price_history(changed_at DESC);

CREATE INDEX idx_sales_azs_id ON sales_data(azs_id);
CREATE INDEX idx_sales_date ON sales_data(date_recorded DESC);
CREATE INDEX idx_sales_fuel ON sales_data(fuel_type);

CREATE INDEX idx_weather_azs_id ON weather_data(azs_id);
CREATE INDEX idx_weather_date ON weather_data(date_recorded DESC);

CREATE INDEX idx_competitor_azs_id ON competitor_prices(azs_id);
CREATE INDEX idx_competitor_updated ON competitor_prices(last_updated DESC);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_import_imported_by ON import_history(imported_by);
CREATE INDEX idx_import_created ON import_history(imported_at DESC);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date);

CREATE INDEX idx_shop_sales_azs_id ON shop_sales(azs_id);
CREATE INDEX idx_shop_sales_date ON shop_sales(date_recorded DESC);

CREATE INDEX idx_traffic_azs_id ON traffic_data(azs_id);
CREATE INDEX idx_traffic_date ON traffic_data(date_recorded DESC);

-- =====================================================
-- FUNCTIONS FOR AUDIT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER azs_updated_at BEFORE UPDATE ON azs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- Top AZS by revenue
CREATE VIEW v_azs_revenue_summary AS
SELECT
  a.id,
  a.name,
  SUM(s.revenue) as total_revenue,
  SUM(s.volume) as total_volume,
  COUNT(DISTINCT DATE(s.date_recorded)) as days_recorded
FROM azs a
LEFT JOIN sales_data s ON a.id = s.azs_id
GROUP BY a.id, a.name;

-- Price trends
CREATE VIEW v_price_trends AS
SELECT
  p.azs_id,
  a.name,
  p.fuel_type,
  p.price,
  p.previous_price,
  CASE
    WHEN p.previous_price IS NULL THEN 0
    ELSE ROUND(((p.price - p.previous_price) / p.previous_price * 100)::numeric, 2)
  END as price_change_percent,
  p.trend,
  p.updated_at
FROM prices p
JOIN azs a ON p.azs_id = a.id;

-- Recommendations effectiveness
CREATE VIEW v_recommendations_stats AS
SELECT
  type,
  COUNT(*) as total_count,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  ROUND(AVG(confidence)::numeric, 2) as avg_confidence,
  ROUND(AVG(COALESCE(estimated_revenue, 0))::numeric, 2) as avg_revenue
FROM recommendations
GROUP BY type;

-- =====================================================
-- Sample Data will be inserted by seed.sql
-- =====================================================
