/**
 * Проверка ролей для маршрутов. Роль читается из таблицы users на каждый запрос,
 * потому что в JWT роли нет (роль может измениться после выдачи токена).
 */
import { Request, Response, NextFunction } from 'express';
import { getPool } from '@config/database';
import { UUID_RE } from '@utils/uuid';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

const FORBIDDEN = { success: false, error: 'Недостаточно прав' };

/** Роль текущего пользователя; null, если идентификатор неверный или пользователь не найден */
export async function currentRole(req: Request): Promise<string | null> {
  const userId = (req as any).user?.id;
  if (!userId || !UUID_RE.test(userId)) return null;
  const { rows } = await getPool().query(`SELECT role FROM users WHERE id = $1`, [userId]);
  return rows[0]?.role ?? null;
}

/** Пропускает дальше только пользователей с одной из перечисленных ролей; остальным — 403 */
export function requireRole(roles: string[]): Handler {
  return async (req, res, next) => {
    try {
      const role = await currentRole(req);
      if (!role || !roles.includes(role)) {
        return res.status(403).json(FORBIDDEN);
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
