/**
 * Загрузка CSV через интерфейс и журнал загрузок (public.import_history).
 */
import { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { getPool } from '@config/database';
import { importCsv } from '@services/import.service';
import { generateRecommendations } from '@services/recommendations.service';
import { syncPublic } from '@services/public-sync.service';
import { createBackup, listBackups } from '@services/backup.service';
import { requireRole } from '@middleware/roles.middleware';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

export function registerImportRoutes(
  app: Express,
  authenticateToken: Handler,
  asyncHandler: (fn: (req: Request, res: Response) => Promise<unknown>) => Handler
) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  /** Загрузка одного или нескольких CSV (поле file, до 20 файлов). Файлы идут по очереди, ошибка одного не останавливает остальные */
  app.post(
    '/api/import/csv',
    authenticateToken,
    requireRole(['admin', 'manager']),
    upload.array('file', 20),
    asyncHandler(async (req, res) => {
      const files = ((req as any).files as Express.Multer.File[] | undefined) ?? [];
      if (!files.length) return res.status(400).json({ success: false, error: 'Файл не передан' });
      const userId = (req as any).user?.id ?? null;
      const results: { fileName: string; ok: boolean; data?: unknown; error?: string }[] = [];
      for (const file of files) {
        try {
          const data = await importCsv(file.originalname, file.buffer, userId, { recalc: false });
          results.push({ fileName: file.originalname, ok: true, data });
        } catch (e: any) {
          results.push({ fileName: file.originalname, ok: false, error: e.message });
        }
      }
      // синхронизация приложения и пересчёт рекомендаций — один раз после всего пакета,
      // чтобы новые АЗС из загруженных файлов сразу появились в пульте
      let publicSync: unknown = null;
      let recommendations: unknown = null;
      if (results.some((r) => r.ok)) {
        try {
          publicSync = await syncPublic();
        } catch (e: any) {
          publicSync = { error: String(e.message) };
        }
        try {
          recommendations = await generateRecommendations();
        } catch (e: any) {
          recommendations = { error: String(e.message) };
        }
      }
      res.json({ success: true, data: { files: results, publicSync, recommendations } });
    })
  );

  /** Список резервных копий (admin, manager) */
  app.get(
    '/api/import/backups',
    authenticateToken,
    requireRole(['admin', 'manager']),
    asyncHandler(async (_req, res) => {
      res.json({ success: true, data: listBackups() });
    })
  );

  /** Полная резервная копия базы вручную (admin) */
  app.post(
    '/api/admin/backup',
    authenticateToken,
    requireRole(['admin']),
    asyncHandler(async (_req, res) => {
      const file = await createBackup('manual');
      res.json({ success: true, data: { file } });
    })
  );

  /** Сводка по данным (FR-5.9): периоды, объёмы и источники загрузок */
  app.get(
    '/api/import/summary',
    authenticateToken,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const [periods, sources] = await Promise.all([
        pool.query(`
        SELECT 'Продажи и цены топлива' AS dataset, min(sale_date)::text AS from_date, max(sale_date)::text AS to_date, count(*)::int AS rows FROM azs.fuel_daily
        UNION ALL SELECT 'Трафик', min(traffic_date)::text, max(traffic_date)::text, count(*)::int FROM azs.traffic_daily
        UNION ALL SELECT 'Погода', min(weather_date)::text, max(weather_date)::text, count(*)::int FROM azs.weather_daily
        UNION ALL SELECT 'Цены конкурентов', min(observed_at)::date::text, max(observed_at)::date::text, count(*)::int FROM azs.competitor_price
        UNION ALL SELECT 'Продажи магазина', min(sale_date)::text, max(sale_date)::text, count(*)::int FROM azs.shop_sales_daily
        UNION ALL SELECT 'Акции', min(start_date)::text, max(COALESCE(end_date, start_date))::text, count(*)::int FROM azs.promotion`),
        pool.query(`
        SELECT import_type, max(imported_at) AS last_import,
               count(*) FILTER (WHERE status = 'completed')::int AS ok_count,
               count(*) FILTER (WHERE status = 'failed')::int AS failed_count,
               COALESCE(sum(record_count) FILTER (WHERE status = 'completed'), 0)::int AS records
          FROM import_history GROUP BY import_type ORDER BY last_import DESC`),
      ]);
      res.json({ success: true, data: { periods: periods.rows, sources: sources.rows } });
    })
  );

  app.get(
    '/api/import/history',
    authenticateToken,
    asyncHandler(async (_req, res) => {
      const { rows } = await getPool().query(
        `SELECT h.id, h.file_name, h.import_type, h.record_count, h.status, h.error_message, h.imported_at,
              u.username AS imported_by
         FROM import_history h LEFT JOIN users u ON u.id = h.imported_by
        ORDER BY h.imported_at DESC LIMIT 50`
      );
      res.json({ success: true, data: rows });
    })
  );
}
