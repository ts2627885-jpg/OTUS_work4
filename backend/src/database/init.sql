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

-- Insert seed users
INSERT INTO users (username, email, password_hash, role, permissions)
VALUES
  ('admin', 'admin@azs-pult.ru', '$2b$10$/SRVk6j0ckLn8Nh9UakdYOz4Q92z3emWQ76CE8SKZWiEzYkWjxgEO', 'admin', ARRAY['*']),
  ('manager', 'manager@azs-pult.ru', '$2b$10$4UX66jyYU6ywt5/Tduuf0uuS3BBF0b31h6f5Y9T.bn7zwCDPq6KiK', 'manager', ARRAY['manage_azs', 'manage_prices', 'view_analytics']),
  ('analyst', 'analyst@azs-pult.ru', '$2b$10$t/rONq4nDyFx7UozRJR.2OTgHUTIMeJ0T5NfyAkV/JkfRTFhpjrAi', 'analyst', ARRAY['view_analytics', 'generate_recommendations']),
  ('viewer', 'viewer@azs-pult.ru', '$2b$10$3WepK3I.pGtsKkb2ddTuOemCmfy4mAy8i.FYVcTSO/B9K/MfNaJKK', 'viewer', ARRAY['view_analytics'])
ON CONFLICT (username) DO NOTHING;

-- Демо-станции удалены: станции загружаются из данных (см. _BD/pipeline)



-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prices_azs_id ON prices(azs_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_azs_id ON recommendations(azs_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
