/**
 * Вход через OAuth2 (Google, Яндекс ID): Authorization Code flow.
 *
 * Провайдер включается, только если заданы его CLIENT_ID и CLIENT_SECRET:
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   YANDEX_CLIENT_ID / YANDEX_CLIENT_SECRET
 * Адрес приложения для возврата от провайдера: OAUTH_PUBLIC_URL (без завершающего «/»).
 * Redirect URI в консоли провайдера: <OAUTH_PUBLIC_URL>/api/auth/oauth/<provider>/callback
 *
 * Защита: параметр state подписан HMAC и привязан к cookie браузера (CSRF при возврате);
 * почта должна быть подтверждена провайдером (Google: email_verified);
 * существующие локальные учётки по почте не связываются автоматически.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPool } from '@config/database';
import { logger } from '@utils/logger';

export type ProviderId = 'google' | 'yandex';

export interface OAuthProvider {
  id: ProviderId;
  name: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

/** Нормализованный профиль пользователя у провайдера */
export interface OAuthProfile {
  provider: ProviderId;
  subject: string;
  email: string;
  login: string;
}

/** Ошибка входа с кодом, который фронтенд показывает пользователю */
export class OAuthError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const PROVIDER_DEFS: Record<ProviderId, Omit<OAuthProvider, 'clientId' | 'clientSecret'>> = {
  google: {
    id: 'google',
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  yandex: {
    id: 'yandex',
    name: 'Яндекс',
    authUrl: 'https://oauth.yandex.ru/authorize',
    tokenUrl: 'https://oauth.yandex.ru/token',
    scope: 'login:email login:info',
  },
};

const ENV_PREFIX: Record<ProviderId, string> = { google: 'GOOGLE', yandex: 'YANDEX' };

/** Провайдеры, для которых заданы учётные данные приложения */
export function getEnabledProviders(env: NodeJS.ProcessEnv = process.env): OAuthProvider[] {
  if (!env.OAUTH_PUBLIC_URL) return [];
  return (Object.keys(PROVIDER_DEFS) as ProviderId[])
    .map((id) => {
      const clientId = env[`${ENV_PREFIX[id]}_CLIENT_ID`] || '';
      const clientSecret = env[`${ENV_PREFIX[id]}_CLIENT_SECRET`] || '';
      return { ...PROVIDER_DEFS[id], clientId, clientSecret };
    })
    .filter((p) => p.clientId && p.clientSecret);
}

export function getProvider(
  id: string,
  env: NodeJS.ProcessEnv = process.env
): OAuthProvider | undefined {
  return getEnabledProviders(env).find((p) => p.id === id);
}

export function redirectUri(provider: ProviderId, env: NodeJS.ProcessEnv = process.env): string {
  return `${env.OAUTH_PUBLIC_URL}/api/auth/oauth/${provider}/callback`;
}

/** Секрет для подписи state: отдельный или общий с JWT (не короче 32 символов) */
function stateSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.OAUTH_STATE_SECRET || env.JWT_SECRET || '';
  if (secret.length < 32)
    throw new Error('OAUTH_STATE_SECRET или JWT_SECRET не короче 32 символов');
  return secret;
}

export function createState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** Значение для cookie: state + HMAC */
export function signState(state: string, env: NodeJS.ProcessEnv = process.env): string {
  const mac = crypto.createHmac('sha256', stateSecret(env)).update(state).digest('base64url');
  return `${state}.${mac}`;
}

/** Проверяет cookie и совпадение с параметром state из адреса возврата */
export function verifyState(
  cookieValue: string | undefined,
  stateParam: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!cookieValue || !stateParam) return false;
  const dot = cookieValue.lastIndexOf('.');
  if (dot <= 0) return false;
  const state = cookieValue.slice(0, dot);
  const expected = signState(state, env);
  const a = Buffer.from(expected);
  const b = Buffer.from(cookieValue);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return (
    state.length === stateParam.length &&
    crypto.timingSafeEqual(Buffer.from(state), Buffer.from(stateParam))
  );
}

export function buildAuthUrl(
  provider: OAuthProvider,
  state: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri(provider.id, env),
    response_type: 'code',
    scope: provider.scope,
    state,
  });
  return `${provider.authUrl}?${params.toString()}`;
}

/** Обмен кода на токен доступа провайдера (серверный запрос, секрет не уходит в браузер) */
async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  env: NodeJS.ProcessEnv
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(provider.id, env),
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
  });
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !data.access_token) throw new OAuthError('token_exchange_failed');
  return data.access_token;
}

/** Профиль пользователя у провайдера; без подтверждённой почты вход не разрешается */
async function fetchProfile(provider: ProviderId, accessToken: string): Promise<OAuthProfile> {
  if (provider === 'google') {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const d = (await res.json().catch(() => ({}))) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!res.ok || !d.sub) throw new OAuthError('profile_failed');
    if (!d.email || d.email_verified !== true) throw new OAuthError('email_not_verified');
    return { provider, subject: d.sub, email: d.email.toLowerCase(), login: d.email.split('@')[0] };
  }

  const res = await fetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  const d = (await res.json().catch(() => ({}))) as {
    id?: string;
    login?: string;
    default_email?: string;
  };
  if (!res.ok || !d.id) throw new OAuthError('profile_failed');
  if (!d.default_email) throw new OAuthError('email_not_verified');
  return {
    provider,
    subject: String(d.id),
    email: d.default_email.toLowerCase(),
    login: d.login || d.default_email.split('@')[0],
  };
}

/** Код → профиль: полный серверный шаг после возврата от провайдера */
export async function fetchOAuthProfile(
  provider: OAuthProvider,
  code: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<OAuthProfile> {
  const accessToken = await exchangeCode(provider, code, env);
  return fetchProfile(provider.id, accessToken);
}

/** Имя пользователя из логина провайдера: латиница и цифры, 3–30 символов (как при обычном входе) */
export function usernameBase(login: string): string {
  const cleaned = login.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  return cleaned.length >= 3 ? cleaned : 'user';
}

/**
 * Находит пользователя по внешней учётке или создаёт нового (роль viewer, пароль не задан).
 * Если почта уже занята локальной учёткой, связка не создаётся: OAuthError('email_taken').
 */
export async function resolveOAuthUser(profile: OAuthProfile): Promise<string> {
  const pool = getPool();

  const linked = await pool.query(
    `SELECT u.id, u.is_active FROM oauth_accounts o JOIN users u ON u.id = o.user_id
     WHERE o.provider = $1 AND o.provider_user_id = $2`,
    [profile.provider, profile.subject]
  );
  if (linked.rows[0]) {
    if (!linked.rows[0].is_active) throw new OAuthError('account_disabled');
    return linked.rows[0].id as string;
  }

  const byEmail = await pool.query('SELECT 1 FROM users WHERE email = $1', [profile.email]);
  if (byEmail.rowCount) throw new OAuthError('email_taken');

  const base = usernameBase(profile.login);
  let username = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (!taken.rowCount) break;
    username = `${base}${crypto.randomBytes(3).toString('hex')}`;
  }

  // Пароль нельзя угадать: это случайная строка, которую никто не знает
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'viewer', true) RETURNING id`,
      [username, profile.email, passwordHash]
    );
    const userId = created.rows[0].id as string;
    await client.query(
      `INSERT INTO oauth_accounts (provider, provider_user_id, user_id, email)
       VALUES ($1, $2, $3, $4)`,
      [profile.provider, profile.subject, userId, profile.email]
    );
    await client.query('COMMIT');
    logger.info('OAuth user created', 'OAuth', { provider: profile.provider, userId });
    return userId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Журнал без персональных данных: только провайдер и причина */
export function logOAuthFailure(provider: string, reason: string) {
  logger.warn('OAuth login failed', 'OAuth', { provider, reason });
}
