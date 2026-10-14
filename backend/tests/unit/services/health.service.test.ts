/**
 * Проверка готовности (services/health.service).
 * Позитивный сценарий: база отвечает — статус ok.
 * Ошибка: база отвечает ошибкой или не отвечает за время таймаута — статус fail.
 */
import { checkDatabase } from '@services/health.service';

describe('checkDatabase', () => {
  it('возвращает ok, когда база отвечает', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };
    const result = await checkDatabase(pool as never);
    expect(result.status).toBe('ok');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('возвращает fail при ошибке запроса и не раскрывает её текст', async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error('password authentication failed for user "x"')),
    };
    const result = await checkDatabase(pool as never);
    expect(result.status).toBe('fail');
    expect(Object.keys(result).sort()).toEqual(['latencyMs', 'status']);
  });

  it('возвращает fail, если база не ответила за таймаут', async () => {
    const pool = { query: jest.fn(() => new Promise(() => undefined)) };
    const result = await checkDatabase(pool as never, 20);
    expect(result.status).toBe('fail');
  });
});
