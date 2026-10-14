/**
 * Application Entry Point
 * Initializes Express server with middleware and routes
 *
 * Architecture:
 * Express App
 *   ├── Security Middleware (helmet, cors)
 *   ├── Request Logging
 *   ├── Body Parsers
 *   ├── Routes
 *   │   ├── POST /api/auth/login
 *   │   ├── POST /api/auth/register
 *   │   ├── GET /api/auth/profile (requires auth)
 *   │   └── ... more routes
 *   ├── Not Found Handler (404)
 *   └── Error Handler (catches all errors)
 */

import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import middleware
import { errorHandler, asyncHandler, notFound } from '@middleware/errorHandler.middleware';
import { requestLogger, healthCheck } from '@middleware/requestLogger.middleware';
import { createAuthMiddleware } from '@middleware/auth.middleware';
import { dbContextMiddleware } from '@middleware/db-context.middleware';

// Import config
import { getPool, getRawPool } from '@config/database';
import { enableDbLogSink } from '@utils/db-log-sink';
import { computeRulesCached, warmRulesCache } from '@services/rules.service';
import { registerStationRoutes } from './routes/stations.routes';
import { registerImportRoutes } from './routes/import.routes';
import { registerRecommendationRoutes } from './routes/recommendations.routes';
import { registerAdminRoutes } from './routes/admin.routes';
import { registerAnalyticsRoutes } from './routes/analytics.routes';
import { registerDashboardRoutes } from './routes/dashboard.routes';
import { registerOAuthRoutes } from './routes/oauth.routes';
import {
  actorOf,
  accessibleStationIds,
  canAccessStation,
  logLogin,
} from './services/access.service';

// Import services and repositories
import { AuthService } from '@services/auth.service';
import { UserRepository } from '@repositories/user.repository';

// Import controllers
import { AuthController } from '@controllers/auth.controller';

// Import mock data

// Import utilities
import { logger } from '@utils/logger';

// Load environment variables
dotenv.config();

/**
 * Create Express application
 */
export function createApp(): Express {
  const app = express();

  // Один прокси перед приложением (Vercel, nginx): реальный адрес клиента — из X-Forwarded-For.
  // Без этого все клиенты получают адрес прокси и лимит входа срабатывает для всех сразу.
  app.set('trust proxy', 1);

  // ============================================
  // 🔒 Security Middleware
  // ============================================
  app.use(helmet());

  // версионирование API (FR-6.1): /api/v1/... обрабатывается теми же маршрутами, что /api/...
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/v1/')) req.url = '/api/' + req.url.slice('/api/v1/'.length);
    next();
  });

  app.use(
    cors({
      // FRONTEND_URL — список адресов фронтенда через запятую
      origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ============================================
  // 📝 Request Processing Middleware
  // ============================================
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(requestLogger);
  // Контекст базы (RLS) на каждый запрос к API: соединение запроса и роль пользователя
  app.use('/api', dbContextMiddleware());

  // ============================================
  // 📊 Health Check
  // ============================================
  app.get('/health', healthCheck);
  app.get('/healthz', healthCheck);
  app.get('/api/health', healthCheck);

  // ============================================
  // 🔧 Initialize Services & Controllers
  // ============================================
  const db = getPool();
  // Предупреждения и ошибки — в таблицу app_logs, если включено (для Supabase)
  if (process.env.LOG_TO_DB === 'true') enableDbLogSink(getRawPool());

  const userRepository = new UserRepository(db);
  const authService = new AuthService(userRepository);
  const authController = new AuthController(authService);

  // Create auth middleware
  const authenticateToken = createAuthMiddleware(authService);

  // ============================================
  // 🛣️ Routes
  // ============================================

  // --------- Authentication Routes ---------
  // Защита от перебора паролей: не более 10 неудачных попыток входа с одного адреса за 15 минут.
  // Успешные входы не считаются. Счётчик хранится в памяти процесса: на serverless-платформе
  // у каждого экземпляра свой счётчик, поэтому полная защита требует общего хранилища (Redis).
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Слишком много неудачных попыток входа. Повторите через 15 минут.',
      code: 'RATE_LIMITED',
    },
  });

  app.post('/api/auth/login', loginLimiter, (req, res, next) => {
    // журнал входов: успех или ошибка (FR-1.2)
    res.on('finish', () => {
      logLogin(req, res.statusCode);
    });
    authController.login(req, res).catch(next);
  });

  app.post('/api/auth/register', (req, res, next) => {
    authController.register(req, res).catch(next);
  });

  // Вход через OAuth2 (Google, Яндекс ID): включается только при заданных CLIENT_ID/SECRET
  registerOAuthRoutes(app, authService);

  app.post('/api/auth/logout', authenticateToken, (req, res, next) => {
    authController.logout(req, res).catch(next);
  });

  app.get('/api/auth/profile', authenticateToken, (req, res, next) => {
    authController.getProfile(req, res).catch(next);
  });

  app.post('/api/auth/refresh', authenticateToken, (req, res, next) => {
    authController.refreshToken(req, res).catch(next);
  });

  // --------- AZS Routes ---------
  // Данные читаются из таблиц public (azs, prices, recommendations, users)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const toNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  app.get(
    '/api/azs',
    authenticateToken,
    asyncHandler(async (req, res) => {
      // менеджер видит только назначенные станции (FR-2.2)
      const ids = await accessibleStationIds(await actorOf(req));
      const { rows } = await getPool().query(
        `SELECT id, name, address, region, fuel_types, manager, status, latitude, longitude
       FROM azs WHERE ($1::uuid[] IS NULL OR id = ANY($1::uuid[])) ORDER BY name`,
        [ids]
      );
      res.json({
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          address: r.address,
          region: r.region,
          fuelTypes: r.fuel_types,
          manager: r.manager,
          status: r.status,
          latitude: toNum(r.latitude),
          longitude: toNum(r.longitude),
        })),
      });
    })
  );

  app.get(
    '/api/azs/:id',
    authenticateToken,
    asyncHandler(async (req, res) => {
      if (!UUID_RE.test(req.params.id))
        return res.status(404).json({ success: false, error: 'Not found' });
      if (!(await canAccessStation(await actorOf(req), req.params.id))) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      const { rows } = await getPool().query(
        `SELECT id, name, address, region, fuel_types, manager, status, latitude, longitude
       FROM azs WHERE id = $1`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ success: false, error: 'Not found' });
      const r = rows[0];
      res.json({
        success: true,
        data: {
          id: r.id,
          name: r.name,
          address: r.address,
          region: r.region,
          fuelTypes: r.fuel_types,
          manager: r.manager,
          status: r.status,
          latitude: toNum(r.latitude),
          longitude: toNum(r.longitude),
        },
      });
    })
  );

  registerAdminRoutes(app, authenticateToken, asyncHandler);
  registerAnalyticsRoutes(app, authenticateToken, asyncHandler);
  registerDashboardRoutes(app, authenticateToken, asyncHandler);
  registerImportRoutes(app, authenticateToken, asyncHandler);

  // POST/PUT/DELETE станций и аналитика станции — в routes/stations.routes.ts
  registerStationRoutes(app, authenticateToken, asyncHandler);

  // --------- Prices Routes ---------
  const visibleRows = async (req: any, rows: any[]) => {
    const ids = await accessibleStationIds(await actorOf(req));
    return ids === null ? rows : rows.filter((r) => ids.includes(r.id));
  };
  // Текущие цены: последнее известное значение по каждой станции и топливу из azs.fuel_daily
  // (public.prices — устаревший снимок 2025 года, не используется)
  app.get(
    '/api/prices',
    authenticateToken,
    asyncHandler(async (req, res) => {
      const { rows } = await getPool().query(
        `WITH latest AS (
         SELECT DISTINCT ON (station_code, fuel_code) station_code, fuel_code, price::float AS price, sale_date
           FROM azs.fuel_daily WHERE price IS NOT NULL
          ORDER BY station_code, fuel_code, sale_date DESC),
       prev AS (
         SELECT DISTINCT ON (f.station_code, f.fuel_code) f.station_code, f.fuel_code, f.price::float AS price
           FROM azs.fuel_daily f JOIN latest l ON l.station_code = f.station_code AND l.fuel_code = f.fuel_code
          WHERE f.price IS NOT NULL AND f.sale_date < l.sale_date
          ORDER BY f.station_code, f.fuel_code, f.sale_date DESC)
       SELECT a.id, a.name, l.fuel_code, l.price, p.price AS prev_price, l.sale_date
         FROM latest l
         JOIN public.azs a ON substring(a.name from '(\\d{3})$') = l.station_code
         LEFT JOIN prev p ON p.station_code = l.station_code AND p.fuel_code = l.fuel_code
        ORDER BY a.name, l.fuel_code`
      );
      res.json({
        success: true,
        data: (await visibleRows(req, rows)).map((r) => ({
          id: `${r.id}-${r.fuel_code}`,
          azsId: r.id,
          azsName: r.name,
          fuelType: r.fuel_code,
          price: r.price,
          previousPrice: r.prev_price,
          trend:
            r.prev_price === null
              ? 'stable'
              : r.price > r.prev_price
                ? 'up'
                : r.price < r.prev_price
                  ? 'down'
                  : 'stable',
          updatedAt: r.sale_date,
        })),
      });
    })
  );

  // --------- Analysis (AI_Agent_Rules) ---------
  app.get(
    '/api/analysis/rules',
    authenticateToken,
    asyncHandler(async (_req, res) => {
      res.json({ success: true, data: await computeRulesCached() });
    })
  );

  // --------- Recommendations: генерация, список, «выполнено» — в routes/recommendations.routes.ts ---------
  registerRecommendationRoutes(app, authenticateToken, asyncHandler);

  // --------- Admin Routes ---------

  app.get(
    '/api/admin/stats/overall',
    authenticateToken,
    asyncHandler(async (_req, res) => {
      const { rows } = await getPool().query(`
      SELECT
        (SELECT count(*) FROM azs)::int AS total_azs,
        (SELECT count(*) FROM users)::int AS total_users,
        (SELECT count(*) FROM recommendations WHERE status IS DISTINCT FROM 'completed')::int AS active_recommendations,
        (SELECT count(*) FROM recommendations WHERE status = 'completed')::int AS completed_recommendations,
        (SELECT round(avg(price), 2) FROM prices) AS avg_price`);
      const r = rows[0];
      res.json({
        success: true,
        data: {
          totalAZS: r.total_azs,
          totalUsers: r.total_users,
          activeRecommendations: r.active_recommendations,
          completedRecommendations: r.completed_recommendations,
          avgPrice: toNum(r.avg_price),
        },
      });
    })
  );

  // ============================================
  // 🚫 Error Handling
  // ============================================

  // Not found handler (404) - must be before error handler
  app.use(notFound);

  // Global error handler - must be last
  app.use(errorHandler);

  return app;
}

/**
 * Start server
 */
async function startServer(): Promise<void> {
  try {
    const app = createApp();
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    const server = app.listen(port, host, () => {
      logger.info(`Server started`, 'Server', {
        host,
        port,
        nodeEnv: process.env.NODE_ENV || 'development',
      });
      // Прогрев кэша расчёта правил в фоне: первый пользователь получит быстрый ответ
      warmRulesCache();
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received', 'Server');
      server.close(() => {
        logger.info('Server closed', 'Server');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received', 'Server');
      server.close(() => {
        logger.info('Server closed', 'Server');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error, 'Server');
    process.exit(1);
  }
}

// Start server if this is the entry point
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Unhandled error', error, 'Server');
    process.exit(1);
  });
}

export default createApp;
