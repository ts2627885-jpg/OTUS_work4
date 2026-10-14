-- Внешние учётные записи OAuth2 (Google, Яндекс ID).
-- Связка: провайдер + идентификатор пользователя у провайдера -> локальный пользователь.
-- Вход через провайдера не связывает существующие локальные учётки по почте: это исключает
-- захват учётки администратора через провайдера.

CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider VARCHAR(20) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_idx ON oauth_accounts(user_id);

-- RLS: callback входа работает в контексте anonymous (как вход по паролю)
ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oauth_accounts_select ON oauth_accounts;
CREATE POLICY oauth_accounts_select ON oauth_accounts FOR SELECT
  USING (app_role() IN ('anonymous', 'admin'));

DROP POLICY IF EXISTS oauth_accounts_insert ON oauth_accounts;
CREATE POLICY oauth_accounts_insert ON oauth_accounts FOR INSERT
  WITH CHECK (app_role() = 'anonymous');

-- Права роли приложения (как в 017): выдаются только если роль существует
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azs_app') THEN
    EXECUTE 'GRANT SELECT, INSERT ON oauth_accounts TO azs_app';
  END IF;
END $$;
