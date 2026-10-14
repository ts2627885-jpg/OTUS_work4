/**
 * Контекст базы на каждый запрос /api (для RLS, см. config/request-context.ts).
 *
 * До проверки токена запрос идёт с ролью 'anonymous': вход, запись в журналы.
 * После проверки токена auth.middleware выставляет роль пользователя.
 * По окончании запроса соединение возвращается в пул с сброшенным контекстом,
 * иначе фоновый код мог бы получить чужую роль.
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { PoolClient } from 'pg';
import { getRawPool } from '@config/database';
import { requestScope } from '@config/request-context';
import { logger } from '@utils/logger';

export function dbContextMiddleware(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    getRawPool()
      .connect()
      .then(async (client: PoolClient) => {
        let released = false;

        // Сбрасываем настройки и возвращаем соединение; при ошибке сброса соединение уничтожаем
        const release = async () => {
          if (released) return;
          released = true;
          try {
            await client.query('RESET app.role; RESET app.user_id');
            client.release();
          } catch (error) {
            logger.error(
              'Failed to reset DB context, dropping connection',
              error as Error,
              'DbContext'
            );
            client.release(error as Error);
          }
        };
        res.on('finish', release);
        res.on('close', release);

        try {
          await client.query(
            "SELECT set_config('app.role', 'anonymous', false), set_config('app.user_id', '', false)"
          );
        } catch (error) {
          await release();
          throw error;
        }

        requestScope.run({ client }, () => next());
      })
      .catch(next);
  };
}
