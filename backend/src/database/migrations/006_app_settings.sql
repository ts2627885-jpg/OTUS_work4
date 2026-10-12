-- Настройки расчёта правил (FR-5.10): пороги и окна. Хранятся по ключу, история — в audit_logs.
CREATE TABLE IF NOT EXISTS app_settings (
  key         varchar(100) PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamp NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL
);
