/**
 * Проверка готовности приложения для мониторинга (GET /api/health/ready).
 * Проверяет доступность базы запросом SELECT 1 с таймаутом. Детали ошибки в ответ не
 * выводятся (они могут содержать имя хоста и пользователя): их пишем в журнал на сервере.
 */
import { Pool } from 'pg';
import { logger } from '@utils/logger';

export interface DatabaseCheck {
  status: 'ok' | 'fail';
  latencyMs: number;
}

export async function checkDatabase(
  pool: Pick<Pool, 'query'>,
  timeoutMs = 3000
): Promise<DatabaseCheck> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('database check timeout')), timeoutMs);
      }),
    ]);
    return { status: 'ok', latencyMs: Date.now() - started };
  } catch (err) {
    logger.warn('Health check: database unavailable', 'Health', {
      reason: (err as Error).message.slice(0, 200),
    });
    return { status: 'fail', latencyMs: Date.now() - started };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
