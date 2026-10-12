-- Журнал аудита сохраняет запись даже после удаления пользователя:
-- имя фиксируется в actor_name, внешний ключ обнуляется при удалении.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name varchar(100);
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
UPDATE audit_logs a SET actor_name = u.username FROM users u WHERE u.id = a.user_id AND a.actor_name IS NULL;
