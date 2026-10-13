/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user info to request
 *
 * ✅ Extract token from Authorization header
 * ✅ Verify JWT signature and expiration
 * ✅ Attach user info to req.user
 * ✅ Return 401 for missing/invalid tokens
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@services/auth.service';
import { AuthenticationError } from '@utils/errors';
import { logger } from '@utils/logger';
import { bindUserContext } from '@config/request-context';

/**
 * Extend Express Request type to include user property
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        role_id: number;
      };
    }
  }
}

/**
 * Authenticate token middleware
 * Verifies JWT from Authorization header
 *
 * Expected header format:
 * Authorization: Bearer <token>
 */
export function createAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.get('Authorization');

      if (!authHeader) {
        logger.warn('Missing Authorization header', 'AuthMiddleware');
        throw new AuthenticationError('Missing authorization token');
      }

      // Parse Bearer token
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        logger.warn('Invalid Authorization header format', 'AuthMiddleware');
        throw new AuthenticationError('Invalid authorization header format');
      }

      const token = parts[1];

      // Verify token
      const payload = authService.verifyToken(token);

      // Attach user info to request
      req.user = {
        id: payload.id,
        username: payload.username,
        email: payload.email,
        role_id: payload.role_id
      };

      // Роль пользователя для RLS: политики в базе увидят app.role и app.user_id этого запроса
      await bindUserContext(payload.id);

      logger.debug(`User authenticated: ${payload.id}`, 'AuthMiddleware');

      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        logger.error('Unexpected error in auth middleware', error as Error, 'AuthMiddleware');
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  };
}

/**
 * Optional auth middleware
 * Verifies JWT if provided, but doesn't require it
 * Useful for public endpoints that can show different content for authenticated users
 */
export function createOptionalAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.get('Authorization');

      if (!authHeader) {
        // No token provided, continue without user
        next();
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        // Invalid format, continue without user
        next();
        return;
      }

      const token = parts[1];

      try {
        const payload = authService.verifyToken(token);
        req.user = {
          id: payload.id,
          username: payload.username,
          email: payload.email,
          role_id: payload.role_id
        };
      } catch (_error) {
        // Invalid token, continue without user
        logger.debug('Optional auth: invalid token provided', 'AuthMiddleware');
      }

      next();
    } catch (error) {
      logger.error('Unexpected error in optional auth middleware', error as Error, 'AuthMiddleware');
      // Continue even on error for optional auth
      next();
    }
  };
}
