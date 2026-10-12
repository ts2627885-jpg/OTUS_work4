-- Привязка менеджеров к станциям (FR-2.2) и журнал входов (FR-1.2).
-- Журнал аудита — существующая таблица audit_logs.
CREATE TABLE IF NOT EXISTS azs_access (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  azs_id      uuid NOT NULL REFERENCES azs(id) ON DELETE CASCADE,
  assigned_at timestamp NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, azs_id)
);
CREATE TABLE IF NOT EXISTS login_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  username    varchar(100),
  status      varchar(10) NOT NULL CHECK (status IN ('success', 'failure')),
  ip_address  varchar(64),
  user_agent  text,
  created_at  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_logs_created_idx ON login_logs (created_at DESC);
