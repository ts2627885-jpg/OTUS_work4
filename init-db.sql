-- Initialize AZS-Pult Database
-- Created for PostgreSQL 15+

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS audit;

-- Create audit tables
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

CREATE INDEX idx_audit_log_table ON audit.audit_log(table_name);
CREATE INDEX idx_audit_log_created ON audit.audit_log(created_at);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO azs_admin;
GRANT USAGE ON SCHEMA audit TO azs_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO azs_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO azs_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO azs_admin;

-- Create application user if not exists
DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'azs_admin') THEN
    CREATE USER azs_admin WITH PASSWORD 'secure-password-here';
  END IF;
END
$$;

-- Alter default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO azs_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO azs_admin;

-- Log initialization
INSERT INTO audit.audit_log (table_name, operation, old_values, new_values)
VALUES ('_system', 'database_init', NULL, jsonb_build_object('version', '2.1.0', 'timestamp', NOW()));
