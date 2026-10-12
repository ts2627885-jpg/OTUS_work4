/**
 * Маршруты станций и пользователей, работающие с базой:
 *   - CRUD станций в public.azs (запись — роли admin и manager);
 *   - аналитика станции из схемы azs: продажи, трафик, погода, цены конкурентов;
 *   - управление пользователями (admin).
 */
import { Express, Request, Response, NextFunction } from 'express';
import { getPool } from '@config/database';
import { actorOf, canAccessStation, audit } from '@services/access.service';
import { requireRole } from '@middleware/roles.middleware';
import { UUID_RE } from '@utils/uuid';

const stationCode = (name: string): string | null => (name.match(/(\d{3})$/) || [])[1] || null;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const daysParam = (v: unknown, def: number) => Math.min(Math.max(parseInt(String(v ?? def), 10) || def, 1), 365);

const mapAzs = (r: any) => ({
  id: r.id, name: r.name, address: r.address, region: r.region,
  fuelTypes: r.fuel_types, manager: r.manager, status: r.status,
  latitude: num(r.latitude), longitude: num(r.longitude)
});

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

export function registerStationRoutes(
  app: Express,
  authenticateToken: Handler,
  asyncHandler: (fn: (req: Request, res: Response) => Promise<unknown>) => Handler
) {
  const pool = () => getPool();

  /** Редактирование станции: admin — любая, manager — только назначенные ему */
  const canEditStation: Handler = async (req, res, next) => {
    try {
      const actor = await actorOf(req);
      if (actor.role === 'admin' || (actor.role === 'manager' && await canAccessStation(actor, req.params.id))) {
        return next();
      }
      return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    } catch (e) {
      next(e);
    }
  };

  /** Найти станцию по UUID; возвращает код станции для аналитики */
  const findStation = async (id: string) => {
    if (!UUID_RE.test(id)) return null;
    const { rows } = await pool().query(
      `SELECT id, name, address, region, fuel_types, manager, status, latitude, longitude FROM azs WHERE id = $1`, [id]
    );
    return rows[0] ?? null;
  };

  // ---------- Проверка АЗС: аналитика (azs) против приложения (public.azs) ----------
  app.get('/api/stations/check', authenticateToken, requireRole(['admin']), asyncHandler(async (_req, res) => {
    const { rows: analytics } = await pool().query(
      `SELECT s.station_code, s.station_name,
              (SELECT count(*)::int FROM azs.fuel_daily f WHERE f.station_code = s.station_code AND f.sales_volume > 0) AS sales_rows,
              (SELECT max(f.sale_date)::text FROM azs.fuel_daily f WHERE f.station_code = s.station_code) AS last_sale
         FROM azs.station s ORDER BY s.station_code`
    );
    const { rows: app } = await pool().query(
      `SELECT a.id, a.name, a.status,
              (SELECT count(*)::int FROM recommendations r WHERE r.azs_id = a.id AND r.status = 'active') AS active_recommendations
         FROM public.azs a ORDER BY a.name`
    );
    const analyticsNames = new Set(analytics.map((s: any) => s.station_name));
    const appNames = new Set(app.map((a: any) => a.name));
    const stations = analytics.map((s: any) => {
      const inApp = app.find((a: any) => a.name === s.station_name);
      return {
        code: s.station_code,
        name: s.station_name,
        inApp: Boolean(inApp),
        activeRecommendations: inApp ? inApp.active_recommendations : null,
        salesRows: s.sales_rows,
        lastSale: s.last_sale
      };
    });
    const missingInApp = [...analyticsNames].filter((n) => !appNames.has(n));
    const extraInApp = [...appNames].filter((n) => !analyticsNames.has(n));
    res.json({
      success: true,
      data: { stations, missingInApp, extraInApp, ok: missingInApp.length === 0 && extraInApp.length === 0 }
    });
  }));

  // ---------- CRUD станций ----------
  app.post('/api/azs', authenticateToken, requireRole(['admin']), asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (!b.name || String(b.name).trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Укажите название станции' });
    }
    const fuels = Array.isArray(b.fuelTypes) ? b.fuelTypes : [];
    const { rows } = await pool().query(
      `INSERT INTO azs (name, address, region, fuel_types, manager, status, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, address, region, fuel_types, manager, status, latitude, longitude`,
      [String(b.name).trim(), b.address ?? '', b.region ?? '', fuels, b.manager ?? null, b.status ?? 'active',
       b.latitude ?? null, b.longitude ?? null]
    );
    await audit(req, (req as any).user?.id ?? null, 'station.create', 'azs', rows[0].id, { name: rows[0].name });
    res.status(201).json({ success: true, data: mapAzs(rows[0]) });
  }));

  app.put('/api/azs/:id', authenticateToken, canEditStation, asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!(await findStation(id))) return res.status(404).json({ success: false, error: 'Not found' });
    const b = req.body || {};
    const { rows } = await pool().query(
      `UPDATE azs SET
         name = COALESCE($2, name),
         address = COALESCE($3, address),
         region = COALESCE($4, region),
         fuel_types = COALESCE($5, fuel_types),
         manager = COALESCE($6, manager),
         status = COALESCE($7, status),
         latitude = COALESCE($8, latitude),
         longitude = COALESCE($9, longitude),
         updated_at = now()
       WHERE id = $1
       RETURNING id, name, address, region, fuel_types, manager, status, latitude, longitude`,
      [id, b.name ?? null, b.address ?? null, b.region ?? null,
       Array.isArray(b.fuelTypes) ? b.fuelTypes : null, b.manager ?? null, b.status ?? null,
       b.latitude ?? null, b.longitude ?? null]
    );
    await audit(req, (req as any).user?.id ?? null, 'station.update', 'azs', id, b);
    res.json({ success: true, data: mapAzs(rows[0]) });
  }));

  app.delete('/api/azs/:id', authenticateToken, requireRole(['admin']), asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!(await findStation(id))) return res.status(404).json({ success: false, error: 'Not found' });
    try {
      await pool().query(`DELETE FROM azs WHERE id = $1`, [id]);
    } catch (e: any) {
      if (e.code === '23503') {
        return res.status(409).json({ success: false, error: 'У станции есть связанные данные (цены, продажи), удаление невозможно' });
      }
      throw e;
    }
    await audit(req, (req as any).user?.id ?? null, 'station.delete', 'azs', id, null);
    res.json({ success: true, message: 'Deleted successfully' });
  }));

  // ---------- Аналитика станции (схема azs, код станции из названия) ----------
  const withCode = (handler: (code: string, req: Request, res: Response) => Promise<unknown>) =>
    asyncHandler(async (req, res) => {
      const st = await findStation(req.params.id);
      if (!st || !(await canAccessStation(await actorOf(req), req.params.id))) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      const code = stationCode(st.name);
      if (!code) return res.json({ success: true, data: [] });
      await handler(code, req, res);
    });

  app.get('/api/azs/:id/sales', authenticateToken, withCode(async (code, req, res) => {
    const { rows } = await pool().query(
      `SELECT sale_date::text AS date, fuel_code, sales_volume::float AS volume, price::float AS price
         FROM azs.fuel_daily
        WHERE station_code = $1 AND sale_date > (SELECT max(sale_date) FROM azs.fuel_daily) - ($2 || ' days')::interval
        ORDER BY sale_date DESC, fuel_code`,
      [code, daysParam(req.query.days, 30)]
    );
    res.json({ success: true, data: rows });
  }));

  app.get('/api/azs/:id/traffic', authenticateToken, withCode(async (code, req, res) => {
    const { rows } = await pool().query(
      `SELECT traffic_date::text AS date, cars::float AS cars, transporters::float AS transporters,
              trucks::float AS trucks, speed::float AS speed, density::float AS density, service_level
         FROM azs.traffic_daily
        WHERE station_code = $1 ORDER BY traffic_date DESC LIMIT $2`,
      [code, daysParam(req.query.days, 14)]
    );
    res.json({ success: true, data: rows });
  }));

  app.get('/api/azs/:id/weather', authenticateToken, withCode(async (code, req, res) => {
    const { rows } = await pool().query(
      `SELECT weather_date::text AS date, temperature_c::float AS temperature, humidity_pct::float AS humidity,
              precipitation_mm::float AS precipitation, wind_speed_ms::float AS wind, weather_type
         FROM azs.weather_daily
        WHERE station_code = $1 ORDER BY weather_date DESC LIMIT $2`,
      [code, daysParam(req.query.days, 14)]
    );
    res.json({ success: true, data: rows });
  }));

  /** Последняя цена каждого конкурента по виду топлива за 30 дней */
  app.get('/api/azs/:id/competitors', authenticateToken, withCode(async (code, _req, res) => {
    const { rows } = await pool().query(
      `SELECT DISTINCT ON (c.brand, cp.fuel_code)
              c.brand, cp.fuel_code, cp.price::float AS price, cp.observed_at::text AS observed_at
         FROM azs.competitor_price cp JOIN azs.competitor c USING (competitor_id)
        WHERE c.station_code = $1 AND cp.is_offered AND cp.price > 0
          AND cp.observed_at > (SELECT max(observed_at) FROM azs.competitor_price) - interval '30 days'
        ORDER BY c.brand, cp.fuel_code, cp.observed_at DESC`,
      [code]
    );
    res.json({ success: true, data: rows });
  }));

  // ---------- Пользователи (admin) ----------
  app.put('/api/admin/users/:id', authenticateToken, requireRole(['admin']), asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(404).json({ success: false, error: 'Not found' });
    const b = req.body || {};
    const roles = ['admin', 'manager', 'analyst', 'viewer'];
    if (b.role !== undefined && !roles.includes(b.role)) {
      return res.status(400).json({ success: false, error: 'Недопустимая роль' });
    }
    const { rows } = await pool().query(
      `UPDATE users SET role = COALESCE($2, role), is_active = COALESCE($3, is_active), updated_at = now()
       WHERE id = $1 RETURNING id, username, email, role, is_active`,
      [id, b.role ?? null, typeof b.is_active === 'boolean' ? b.is_active : null]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Not found' });
    await audit(req, (req as any).user?.id ?? null, 'user.update', 'users', id, b);
    res.json({ success: true, data: rows[0] });
  }));
}
