/**
 * Аналитические вкладки FR-5.2–5.8: GET /api/analytics/:tab?azsId=…
 * Менеджер видит только назначенные ему станции (FR-2.2).
 */
import { Express, Request, Response, NextFunction } from 'express';
import { actorOf, accessibleStationIds, UUID_RE } from '@services/access.service';
import { analyticsTab } from '@services/analytics.service';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

export function registerAnalyticsRoutes(
  app: Express,
  authenticateToken: Handler,
  asyncHandler: (fn: (req: Request, res: Response) => Promise<unknown>) => Handler
) {
  app.get(
    '/api/analytics/:tab',
    authenticateToken,
    asyncHandler(async (req, res) => {
      const azsId =
        typeof req.query.azsId === 'string' && UUID_RE.test(req.query.azsId)
          ? req.query.azsId
          : undefined;
      const allowed = await accessibleStationIds(await actorOf(req));
      // окно эластичности: 7, 28, 90 или 365 дней (по умолчанию — из настроек)
      const w = Number(req.query.window);
      const elasticityDays = [7, 28, 90, 365].includes(w) ? w : undefined;
      try {
        const pw = Number(req.query.promoWindow);
        const promoWindow = [7, 14, 28].includes(pw) ? pw : undefined;
        const data = await analyticsTab(
          req.params.tab,
          allowed,
          azsId,
          elasticityDays,
          promoWindow
        );
        res.json({ success: true, data });
      } catch (e: any) {
        res.status(e.status || 500).json({ success: false, error: e.message });
      }
    })
  );
}
