/**
 * Контекст базы для запросов /api (middleware/db-context.middleware).
 * Позитивный сценарий: маршруты с базой получают контекст RLS.
 * Без базы: проверка здоровья, список провайдеров и старт OAuth не берут соединение.
 */
jest.mock('@config/database', () => ({ getRawPool: jest.fn() }));

import { needsDbContext } from '@middleware/db-context.middleware';

describe('needsDbContext', () => {
  it.each([
    '/api/azs',
    '/api/auth/login',
    '/api/auth/oauth/google/callback',
    '/api/dashboard',
    '/api/health/ready',
  ])('маршрут с базой требует контекст: %s', (path) => {
    expect(needsDbContext(path)).toBe(true);
  });

  it.each([
    '/api/health',
    '/api/auth/oauth/providers',
    '/api/auth/oauth/google/start',
    '/api/auth/oauth/yandex/start',
  ])('маршрут без базы контекст не получает: %s', (path) => {
    expect(needsDbContext(path)).toBe(false);
  });

  it('не путает похожие пути: callback и provider-подстроки остаются с базой', () => {
    expect(needsDbContext('/api/auth/oauth/google/start/extra')).toBe(true);
    expect(needsDbContext('/api/health/extra')).toBe(true);
  });
});
