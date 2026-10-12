/**
 * Рекомендации: генерация по правилам AI_Agent_Rules, сохранение в public.recommendations,
 * список с фильтрами и отметка «выполнено» (FR-4.3–4.5).
 */
import { Express, Request, Response, NextFunction } from 'express';
import { getPool } from '@config/database';
import { generateRecommendations } from '@services/recommendations.service';
import { actorOf, accessibleStationIds } from '@services/access.service';
import { requireRole } from '@middleware/roles.middleware';
import { UUID_RE } from '@utils/uuid';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

const PRIORITY_ORDER = `CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END`;

export function registerRecommendationRoutes(
  app: Express,
  authenticateToken: Handler,
  asyncHandler: (fn: (req: Request, res: Response) => Promise<unknown>) => Handler
) {
  const pool = () => getPool();

  const SELECT_REC = `
    SELECT r.id, r.rule_id, r.title, r.priority, r.status, r.fuel_type, r.action, r.effect, r.reason,
           r.created_at, r.completed_at, a.id AS azs_id, a.name AS station, u.username AS completed_by
      FROM recommendations r
      LEFT JOIN public.azs a ON a.id = r.azs_id
      LEFT JOIN users u ON u.id = r.completed_by`;

  const mapRec = (r: any) => ({
    id: r.id,
    rule: r.rule_id,
    title: r.title,
    priority: r.priority,
    status: r.status,
    fuel: r.fuel_type,
    action: r.action,
    effect: r.effect,
    reason: r.reason,
    azsId: r.azs_id,
    station: r.station || 'Вся сеть',
    createdAt: r.created_at,
    completedAt: r.completed_at,
    completedBy: r.completed_by
  });

  // ---------- Генерация ----------
  app.post('/api/recommendations/generate', authenticateToken, requireRole(['admin']), asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await generateRecommendations() });
  }));

  // ---------- Список с фильтрами ----------
  app.get('/api/recommendations', authenticateToken, asyncHandler(async (req, res) => {
    const { status, priority, azsId, rule } = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (status) add('r.status = ?', status);
    if (priority) add('r.priority = ?', priority);
    if (rule) add('r.rule_id = ?', rule);
    const category = (req.query.category as string | undefined)?.toUpperCase();
    if (category && ['PRICE', 'TRAFFIC', 'COMP', 'PROMO', 'SHOP', 'SYS'].includes(category)) {
      params.push(`${category}-%`);
      where.push(`r.rule_id LIKE $${params.length}`);
    }
    if (azsId && UUID_RE.test(azsId)) add('r.azs_id = ?', azsId);
    const allowed = await accessibleStationIds(await actorOf(req));
    if (allowed !== null) {
      params.push(allowed);
      where.push(`(r.azs_id = ANY($${params.length}::uuid[]) OR r.azs_id IS NULL)`);
    }
    const { rows } = await pool().query(
      `${SELECT_REC} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY (r.status = 'active') DESC, ${PRIORITY_ORDER},
                (CASE WHEN r.effect LIKE '%оценка по эластичности%' THEN 0
                      WHEN r.effect LIKE '≈ ₽%' THEN 1 ELSE 2 END), r.created_at DESC`,
      params
    );
    res.json({ success: true, data: rows.map(mapRec) });
  }));

  app.get('/api/recommendations/azs/:azsId', authenticateToken, asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.azsId)) return res.json({ success: true, data: [] });
    const { rows } = await pool().query(
      `${SELECT_REC} WHERE r.azs_id = $1 ORDER BY (r.status = 'active') DESC, ${PRIORITY_ORDER}, r.created_at DESC`,
      [req.params.azsId]
    );
    res.json({ success: true, data: rows.map(mapRec) });
  }));

  // ---------- Отметка «выполнено» ----------
  app.post('/api/recommendations/:id/complete', authenticateToken, requireRole(['admin', 'manager']), asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(404).json({ success: false, error: 'Not found' });
    const actor = await actorOf(req);
    const target = await pool().query(`SELECT azs_id FROM recommendations WHERE id = $1`, [id]);
    if (!target.rows[0]) return res.status(404).json({ success: false, error: 'Not found' });
    const allowed = await accessibleStationIds(actor);
    const azsId = target.rows[0].azs_id as string | null;
    const permitted = allowed === null || (azsId !== null && allowed.includes(azsId));
    if (!permitted) return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    const { rows } = await pool().query(
      `UPDATE recommendations SET status = 'completed', completed_at = now(), completed_by = $2
        WHERE id = $1 AND status = 'active' RETURNING id`,
      [id, actor.id]
    );
    if (!rows[0]) {
      return res.status(409).json({ success: false, error: 'Рекомендация не найдена или уже закрыта' });
    }
    res.json({ success: true, data: { id } });
  }));
}
