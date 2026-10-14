/**
 * Администрирование (FR-5.10): пользователи, назначение станций менеджерам, журналы входов и аудита.
 * Все маршруты доступны только администратору.
 */
import { Express, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '@config/database';
import { actorOf, audit, UUID_RE } from '@services/access.service';
import {
  DEFAULT_RULE_SETTINGS,
  getRuleSettings,
  saveRuleSettings,
} from '@services/settings.service';
import { buildDraftPlan } from '@services/price-test.service';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

const ROLES = ['admin', 'manager', 'analyst', 'viewer'];

export function registerAdminRoutes(
  app: Express,
  authenticateToken: Handler,
  asyncHandler: (fn: (req: Request, res: Response) => Promise<unknown>) => Handler
) {
  const pool = () => getPool();
  const requireAdmin: Handler = async (req, res, next) => {
    try {
      const actor = await actorOf(req);
      if (actor.role !== 'admin')
        return res.status(403).json({ success: false, error: 'Недостаточно прав' });
      next();
    } catch (e) {
      next(e);
    }
  };
  const me = (req: Request) => (req as any).user?.id as string;
  const limitOf = (v: unknown) =>
    Math.min(Math.max(parseInt(String(v ?? '100'), 10) || 100, 1), 1000);

  // ---------- Пользователи ----------
  app.get(
    '/api/admin/users',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const { rows } = await pool().query(
        `SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at,
              COALESCE(array_agg(a.azs_id) FILTER (WHERE a.azs_id IS NOT NULL), '{}') AS azs_ids
         FROM users u LEFT JOIN azs_access a ON a.user_id = u.id
        GROUP BY u.id ORDER BY u.username`
      );
      res.json({ success: true, data: rows });
    })
  );

  app.post(
    '/api/admin/users',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { username, email, password, role } = req.body || {};
      if (!username || !/^[a-zA-Z0-9]{3,50}$/.test(String(username).trim())) {
        return res
          .status(400)
          .json({ success: false, error: 'Логин: 3–50 латинских букв и цифр (как при входе)' });
      }
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return res.status(400).json({ success: false, error: 'Укажите корректную почту' });
      // Та же политика, что при регистрации (authValidators.register)
      if (
        !password ||
        String(password).length < 8 ||
        String(password).length > 128 ||
        !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(String(password))
      )
        return res.status(400).json({
          success: false,
          error:
            'Пароль: от 8 до 128 символов, заглавные и строчные буквы, цифра и спецсимвол (@$!%*?&)',
        });
      const r = ROLES.includes(role) ? role : 'viewer';
      const exists = await pool().query(`SELECT 1 FROM users WHERE username = $1 OR email = $2`, [
        username,
        email,
      ]);
      if (exists.rowCount)
        return res
          .status(409)
          .json({ success: false, error: 'Пользователь с таким логином или почтой уже есть' });
      const hash = await bcrypt.hash(String(password), 12);
      const { rows } = await pool().query(
        `INSERT INTO users (username, email, password_hash, role, permissions, is_active)
       VALUES ($1, $2, $3, $4, '{}', true)
       RETURNING id, username, email, role, is_active, created_at`,
        [String(username).trim(), String(email).trim(), hash, r]
      );
      await audit(req, me(req), 'user.create', 'users', rows[0].id, {
        username: rows[0].username,
        role: r,
      });
      res.status(201).json({ success: true, data: { ...rows[0], azs_ids: [] } });
    })
  );

  app.delete(
    '/api/admin/users/:id',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (!UUID_RE.test(id)) return res.status(404).json({ success: false, error: 'Not found' });
      if (id === me(req))
        return res
          .status(400)
          .json({ success: false, error: 'Нельзя удалить свою учётную запись' });
      const client = await pool().connect();
      try {
        await client.query('BEGIN');
        await client.query(`UPDATE import_history SET imported_by = NULL WHERE imported_by = $1`, [
          id,
        ]);
        const { rowCount } = await client.query(`DELETE FROM users WHERE id = $1`, [id]);
        await client.query('COMMIT');
        if (!rowCount) return res.status(404).json({ success: false, error: 'Not found' });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      await audit(req, me(req), 'user.delete', 'users', id, null);
      res.json({ success: true, message: 'Deleted successfully' });
    })
  );

  // ---------- Назначение станций менеджеру (FR-2.2) ----------
  app.get(
    '/api/admin/users/:id/azs',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!UUID_RE.test(req.params.id))
        return res.status(404).json({ success: false, error: 'Not found' });
      const { rows } = await pool().query(`SELECT azs_id FROM azs_access WHERE user_id = $1`, [
        req.params.id,
      ]);
      res.json({ success: true, data: rows.map((r) => r.azs_id) });
    })
  );

  app.put(
    '/api/admin/users/:id/azs',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (!UUID_RE.test(id)) return res.status(404).json({ success: false, error: 'Not found' });
      const azsIds: unknown[] = Array.isArray(req.body?.azsIds) ? req.body.azsIds : [];
      const valid = azsIds.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
      const client = await pool().connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM azs_access WHERE user_id = $1`, [id]);
        if (valid.length) {
          await client.query(
            `INSERT INTO azs_access (user_id, azs_id, assigned_by)
           SELECT $1, unnest($2::uuid[]), $3`,
            [id, valid, me(req)]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      await audit(req, me(req), 'user.azs_assign', 'users', id, { azsIds: valid });
      res.json({ success: true, data: valid });
    })
  );

  // ---------- Журналы ----------
  app.get(
    '/api/admin/logs/login',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { rows } = await pool().query(
        `SELECT l.id, l.username, l.status, l.ip_address, l.user_agent, l.created_at
         FROM login_logs l ORDER BY l.created_at DESC LIMIT $1`,
        [limitOf(req.query.limit)]
      );
      res.json({ success: true, data: rows });
    })
  );

  app.get(
    '/api/admin/logs/audit',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { rows } = await pool().query(
        `SELECT a.id, COALESCE(u.username, a.actor_name) AS username, a.action, a.entity_type, a.entity_id, a.changes, a.ip_address, a.created_at
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT $1`,
        [limitOf(req.query.limit)]
      );
      res.json({ success: true, data: rows });
    })
  );

  // ---------- Настройки расчёта и config.json (FR-5.10) ----------
  app.get(
    '/api/admin/settings',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      res.json({
        success: true,
        data: { values: await getRuleSettings(), defaults: DEFAULT_RULE_SETTINGS },
      });
    })
  );

  app.put(
    '/api/admin/settings',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      try {
        const values = await saveRuleSettings(req.body, me(req), req);
        res.json({ success: true, data: values });
      } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
      }
    })
  );

  /** Выгрузка config.json — файл с текущими настройками */
  app.get(
    '/api/admin/settings/export',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const body = JSON.stringify(
        { rules: await getRuleSettings(), exportedAt: new Date().toISOString() },
        null,
        2
      );
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="config.json"');
      res.send(body);
    })
  );

  /** Загрузка config.json: принимается { rules: {...} } или плоный объект настроек */
  app.post(
    '/api/admin/settings/import',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const patch =
        req.body && typeof req.body === 'object' && 'rules' in req.body ? req.body.rules : req.body;
      try {
        const values = await saveRuleSettings(patch, me(req), req);
        res.json({ success: true, data: values });
      } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
      }
    })
  );

  /** История изменений настроек из журнала аудита */
  app.get(
    '/api/admin/settings/history',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const { rows } = await pool().query(
        `SELECT a.created_at, COALESCE(u.username, a.actor_name) AS username, a.changes
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
        WHERE a.action = 'settings.update' ORDER BY a.created_at DESC LIMIT 50`
      );
      res.json({ success: true, data: rows });
    })
  );

  // ---------- План теста цен (PRICE-004): черновик, цены на станциях не меняются ----------
  app.post(
    '/api/admin/price-test/draft',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const info = await buildDraftPlan(me(req));
      await audit(req, me(req), 'price_test.draft', 'price_test_plan', null, info);
      res.status(201).json({ success: true, data: info });
    })
  );

  app.get(
    '/api/admin/price-test',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const { rows } = await pool().query(
        `SELECT p.station_code, p.fuel_code, p.block_no, p.start_date::text, p.end_date::text,
              p.base_price::float AS base_price, p.offset_rub::float AS offset_rub, p.target_price::float AS target_price, p.status
         FROM price_test_plan p ORDER BY p.start_date, p.station_code, p.fuel_code`
      );
      res.json({ success: true, data: rows });
    })
  );
}
