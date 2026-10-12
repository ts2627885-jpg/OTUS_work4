/**
 * Global Error Handler Middleware
 * Catches all errors and formats responses
 *
 * ✅ Catches both sync and async errors
 * ✅ Formats error responses consistently
 * ✅ Logs errors with proper levels
 * ✅ Never leaks sensitive information in production
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '@utils/errors';
import { logger } from '@utils/logger';

/**
 * Global error handler middleware
 * Must be registered AFTER all other middleware and routes
 *
 * @example
 * app.use(errorHandler);
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Extract error info
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'Internal server error';
  const code = isAppError ? err.code : 'INTERNAL_ERROR';

  // Log error
  if (statusCode >= 500) {
    logger.error(message, err, 'ErrorHandler', {
      statusCode,
      code,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });
  } else {
    logger.warn(message, 'ErrorHandler', {
      statusCode,
      code,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });
  }

  // Build response
  const response: any = {
    success: false,
    error: message,
    code
  };

  // Include details in development mode
  if (process.env.NODE_ENV === 'development' && isAppError && err.details) {
    response.details = err.details;
  }

  // Send response
  res.status(statusCode).json(response);
}

/**
 * Async error wrapper for Express route handlers
 * Catches errors and passes to error handler middleware
 *
 * @example
 * router.post('/users', asyncHandler(async (req, res) => {
 *   const user = await createUser(req.body);
 *   res.json(user);
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found (404) handler
 * Should be registered last, catches all unmatched routes
 *
 * @example
 * app.use(notFound);
 */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND'
  });
}
