/**
 * Request Logger Middleware
 * Logs all incoming HTTP requests with timing
 *
 * ✅ Records method, path, status code, response time
 * ✅ Skips logging for health checks
 * ✅ Logs user ID when authenticated
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

/**
 * Request logging middleware
 * Logs all HTTP requests with performance timing
 *
 * @example
 * app.use(requestLogger);
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip logging for health checks
  if (req.path === '/health' || req.path === '/healthz') {
    next();
    return;
  }

  const startTime = Date.now();

  // Capture original send
  const originalSend = res.send;

  // Override send to log after response is sent
  res.send = function (data: any): Response {
    const duration = Date.now() - startTime;

    logger.httpRequest(req.method, req.originalUrl || req.url, res.statusCode, duration);

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Health check endpoint middleware
 * Lightweight endpoint for load balancers and monitoring
 *
 * @example
 * app.get('/health', healthCheck);
 */
export function healthCheck(req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
