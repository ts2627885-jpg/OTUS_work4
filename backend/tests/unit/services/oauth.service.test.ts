/**
 * Вход через OAuth2 (services/oauth.service).
 * Позитивный сценарий: провайдер включается при заданных учётных данных, state подписан и совпадает.
 * Ошибка: подменённый state, отключённый провайдер, занятая почта, деактивированная связка.
 */
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();
jest.mock('@config/database', () => ({
  getPool: () => ({
    query: mockQuery,
    connect: async () => ({ query: mockClientQuery, release: mockRelease }),
  }),
}));

import {
  buildAuthUrl,
  getEnabledProviders,
  getProvider,
  redirectUri,
  resolveOAuthUser,
  signState,
  usernameBase,
  verifyState,
  OAuthError,
} from '@services/oauth.service';

const SECRET = 'x'.repeat(40);
const ENV = {
  OAUTH_PUBLIC_URL: 'https://app.example.com',
  OAUTH_STATE_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'g-id',
  GOOGLE_CLIENT_SECRET: 'g-secret',
} as NodeJS.ProcessEnv;

describe('провайдеры', () => {
  it('включается только при заданных CLIENT_ID и CLIENT_SECRET', () => {
    expect(getEnabledProviders(ENV).map((p) => p.id)).toEqual(['google']);
    expect(
      getEnabledProviders({
        ...ENV,
        YANDEX_CLIENT_ID: 'y',
        YANDEX_CLIENT_SECRET: 's',
      } as NodeJS.ProcessEnv).map((p) => p.id)
    ).toEqual(['google', 'yandex']);
  });

  it('без OAUTH_PUBLIC_URL все провайдеры выключены (отказ по умолчанию)', () => {
    expect(getEnabledProviders({ ...ENV, OAUTH_PUBLIC_URL: '' } as NodeJS.ProcessEnv)).toEqual([]);
  });

  it('неизвестный провайдер не возвращается', () => {
    expect(getProvider('vk', ENV)).toBeUndefined();
  });

  it('адрес возврата строится от OAUTH_PUBLIC_URL', () => {
    expect(redirectUri('google', ENV)).toBe(
      'https://app.example.com/api/auth/oauth/google/callback'
    );
  });

  it('адрес авторизации содержит state и redirect_uri', () => {
    const url = new URL(buildAuthUrl(getProvider('google', ENV)!, 'abc', ENV));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('state')).toBe('abc');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/api/auth/oauth/google/callback'
    );
  });
});

describe('state', () => {
  it('совпадающие cookie и параметр проходят проверку', () => {
    const cookie = signState('state-1', ENV);
    expect(verifyState(cookie, 'state-1', ENV)).toBe(true);
  });

  it('подменённый параметр отвергается', () => {
    const cookie = signState('state-1', ENV);
    expect(verifyState(cookie, 'state-2', ENV)).toBe(false);
  });

  it('подделанная подпись отвергается', () => {
    expect(verifyState('state-1.forged', 'state-1', ENV)).toBe(false);
  });

  it('без cookie или параметра проверка не проходит', () => {
    expect(verifyState(undefined, 'state-1', ENV)).toBe(false);
    expect(verifyState(signState('state-1', ENV), undefined, ENV)).toBe(false);
  });
});

describe('имя пользователя', () => {
  it('берёт латиницу и цифры, остальное убирает', () => {
    expect(usernameBase('Ivan.Petrov-77')).toBe('IvanPetrov77');
  });

  it('короткая или кириллическая основа заменяется на user', () => {
    expect(usernameBase('ab')).toBe('user');
    expect(usernameBase('Иван')).toBe('user');
  });
});

describe('resolveOAuthUser', () => {
  const profile = { provider: 'google' as const, subject: 'sub-1', email: 'a@b.ru', login: 'ivan' };

  beforeEach(() => {
    mockQuery.mockReset();
    mockClientQuery.mockReset();
    mockRelease.mockReset();
  });

  it('возвращает уже связанного активного пользователя', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', is_active: true }] });
    await expect(resolveOAuthUser(profile)).resolves.toBe('u-1');
  });

  it('деактивированная связка не пускает', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', is_active: false }] });
    await expect(resolveOAuthUser(profile)).rejects.toMatchObject({ code: 'account_disabled' });
  });

  it('почта, занятая локальной учёткой, не связывается автоматически', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    const error = await resolveOAuthUser(profile).catch((e) => e);
    expect(error).toBeInstanceOf(OAuthError);
    expect(error.code).toBe('email_taken');
    expect(mockClientQuery).not.toHaveBeenCalled();
  });
});
