/**
 * Доступ к станциям (FR-2.2), журнал аудита и журнал входов (FR-1.2, SEC-4).
 *
 * Правила доступа:
 *   admin, analyst, viewer — все станции (analyst и viewer только читают);
 *   manager — только станции из azs_access.
 */
import { Request } from 'express';
import { getPool } from '@config/database';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Actor {
  id: string;
  role: string | null;
}

/** Роль и id текущего пользователя (роль берётся из базы, в токене её нет) */
export async function actorOf(req: Request): Promise<Actor> {
  const id = (req as any).user?.id as string | undefined;
  if (!id || !UUID_RE.test(id)) return { id: '', role: null };
  const { rows } = await getPool().query(`SELECT role FROM users WHERE id = $1 AND is_active`, [
    id,
  ]);
  return { id, role: rows[0]?.role ?? null };
}

/** Роли, которым доступны все станции (менеджер — только назначенные, остальные — никакие) */
const ALL_STATIONS_ROLES = ['admin', 'analyst', 'viewer'];

/**
 * null — доступны все станции, иначе список id.
 * Роль null (пользователь деактивирован или токен некорректен) — ничего не доступно:
 * неизвестная роль не должна получать полный доступ.
 */
export async function accessibleStationIds(actor: Actor): Promise<string[] | null> {
  if (actor.role && ALL_STATIONS_ROLES.includes(actor.role)) return null;
  if (actor.role !== 'manager') return [];
  const { rows } = await getPool().query(`SELECT azs_id FROM azs_access WHERE user_id = $1`, [
    actor.id,
  ]);
  return rows.map((r) => r.azs_id);
}

export async function canAccessStation(actor: Actor, azsId: string): Promise<boolean> {
  const ids = await accessibleStationIds(actor);
  return ids === null || ids.includes(azsId);
}

/** Запись в журнал аудита: кто, что изменил, с какого адреса */
export async function audit(
  req: Request | null,
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  changes: unknown = null
) {
  try {
    await getPool().query(
      `INSERT INTO audit_logs (user_id, actor_name, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, (SELECT username FROM users WHERE id = $1), $2, $3, $4, $5, $6)`,
      [
        userId,
        action,
        entityType,
        entityId && UUID_RE.test(entityId) ? entityId : null,
        changes === null ? null : JSON.stringify(changes),
        req ? clientIp(req) : null,
      ]
    );
  } catch {
    // журнал не должен прерывать операцию
  }
}

/**
 * Адрес клиента для журналов. req.ip учитывает настройку trust proxy (см. server.ts):
 * берётся адрес, который добавил доверенный прокси, а не значение из заголовка,
 * которое мог подменить клиент.
 */
export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || '';
}

/** Фиксирует попытку входа: успех или ошибка, логин, адрес, браузер */
export async function logLogin(req: Request, statusCode: number) {
  try {
    const username = String((req.body && req.body.username) || '').slice(0, 100);
    const status = statusCode === 200 ? 'success' : 'failure';
    const { rows } = await getPool().query(`SELECT id FROM users WHERE username = $1`, [username]);
    await getPool().query(
      `INSERT INTO login_logs (user_id, username, status, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)`,
      [
        status === 'success' ? (rows[0]?.id ?? null) : null,
        username,
        status,
        clientIp(req),
        String(req.headers['user-agent'] || '').slice(0, 500),
      ]
    );
  } catch {
    // журнал входов не должен мешать входу
  }
}
