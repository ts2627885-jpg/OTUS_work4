/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Roles:
 * 1 = admin      - Full access, can manage users and system
 * 2 = manager    - Can manage AZS stations and prices
 * 3 = analyst    - Can view data and get recommendations
 * 4 = viewer     - Read-only access to public data
 *
 * ✅ Permissions are checked based on role_id
 * ✅ Returns 403 Forbidden if user lacks permission
 * ✅ Logs unauthorized access attempts
 */

import { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '@utils/errors';
import { logger } from '@utils/logger';

/**
 * Role hierarchy
 * Admin > Manager > Analyst > Viewer
 * Higher roles inherit permissions of lower roles
 */
enum RoleId {
  ADMIN = 1,
  MANAGER = 2,
  ANALYST = 3,
  VIEWER = 4
}

/**
 * Permission to role mapping
 * Each permission is assigned to roles that have it
 */
const permissionMap: Record<string, RoleId[]> = {
  // User management (admin only)
  'users_list': [RoleId.ADMIN],
  'users_create': [RoleId.ADMIN],
  'users_update': [RoleId.ADMIN],
  'users_delete': [RoleId.ADMIN],
  'users_manage': [RoleId.ADMIN],

  // AZS management (admin, manager)
  'azs_list': [RoleId.ADMIN, RoleId.MANAGER, RoleId.ANALYST, RoleId.VIEWER],
  'azs_view': [RoleId.ADMIN, RoleId.MANAGER, RoleId.ANALYST, RoleId.VIEWER],
  'azs_create': [RoleId.ADMIN, RoleId.MANAGER],
  'azs_update': [RoleId.ADMIN, RoleId.MANAGER],
  'azs_delete': [RoleId.ADMIN, RoleId.MANAGER],

  // Price management (admin, manager)
  'prices_view': [RoleId.ADMIN, RoleId.MANAGER, RoleId.ANALYST, RoleId.VIEWER],
  'prices_update': [RoleId.ADMIN, RoleId.MANAGER],
  'prices_import': [RoleId.ADMIN, RoleId.MANAGER],

  // Recommendations (admin, manager, analyst)
  'recommendations_view': [RoleId.ADMIN, RoleId.MANAGER, RoleId.ANALYST],
  'recommendations_generate': [RoleId.ADMIN, RoleId.MANAGER, RoleId.ANALYST],

  // Reports (admin, manager, analyst)
  'reports_view': [RoleId.ADMIN, RoleId.MANAGER, RoleId.ANALYST],
  'reports_export': [RoleId.ADMIN, RoleId.MANAGER, RoleId.ANALYST],

  // Logs (admin only)
  'logs_view': [RoleId.ADMIN],
  'logs_export': [RoleId.ADMIN],

  // Dashboard (all authenticated users)
  'dashboard_view': [RoleId.ADMIN, RoleId.MANAGER, RoleId.ANALYST, RoleId.VIEWER],
};

/**
 * Authorize middleware factory
 * Creates middleware that checks if user has required permission
 *
 * @param requiredPermission - Permission to check
 * @returns Express middleware
 *
 * @example
 * router.post('/users', authorize('users_create'), userController.create);
 */
export function authorize(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        logger.warn('Authorize: user not authenticated', 'RBACMiddleware');
        throw new AuthorizationError('Not authenticated');
      }

      // Get required roles for permission
      const allowedRoles = permissionMap[requiredPermission];
      if (!allowedRoles) {
        logger.warn(`Authorize: unknown permission ${requiredPermission}`, 'RBACMiddleware');
        throw new AuthorizationError('Invalid permission');
      }

      // Check if user's role has permission
      if (!allowedRoles.includes(req.user.role_id)) {
        logger.warn(
          `Authorize: insufficient permissions`,
          'RBACMiddleware',
          {
            userId: req.user.id,
            userRole: req.user.role_id,
            requiredPermission,
            allowedRoles
          }
        );
        throw new AuthorizationError(`Insufficient permissions for: ${requiredPermission}`);
      }

      logger.debug(
        `Authorization successful`,
        'RBACMiddleware',
        { userId: req.user.id, permission: requiredPermission }
      );

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        res.status(403).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        logger.error('Unexpected error in authorize middleware', error as Error, 'RBACMiddleware');
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  };
}

/**
 * Check if user has any of multiple permissions
 *
 * @param permissions - Array of permissions to check
 * @returns Express middleware
 *
 * @example
 * router.get('/reports', authorizeAny(['reports_view', 'logs_view']), controller.get);
 */
export function authorizeAny(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Not authenticated');
      }

      // Check if user has any of the required permissions
      const hasPermission = permissions.some(permission => {
        const allowedRoles = permissionMap[permission];
        return allowedRoles && allowedRoles.includes(req.user!.role_id);
      });

      if (!hasPermission) {
        logger.warn(
          `Authorize any: insufficient permissions`,
          'RBACMiddleware',
          { userId: req.user.id, userRole: req.user.role_id, requiredPermissions: permissions }
        );
        throw new AuthorizationError(`Insufficient permissions`);
      }

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        res.status(403).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        logger.error('Unexpected error in authorizeAny middleware', error as Error, 'RBACMiddleware');
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  };
}

/**
 * Check if user has specific role
 *
 * @param roleId - Role ID to check
 * @returns Express middleware
 *
 * @example
 * router.delete('/users/:id', authorizeRole(RoleId.ADMIN), controller.delete);
 */
export function authorizeRole(roleId: RoleId) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Not authenticated');
      }

      if (req.user.role_id !== roleId) {
        throw new AuthorizationError(`Only role ${roleId} can perform this action`);
      }

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        res.status(403).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        logger.error('Unexpected error in authorizeRole middleware', error as Error, 'RBACMiddleware');
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  };
}

/**
 * Require minimum role (and higher)
 * Admin (1) > Manager (2) > Analyst (3) > Viewer (4)
 *
 * @param minRoleId - Minimum role ID required
 * @returns Express middleware
 *
 * @example
 * router.get('/admin/stats', authorizeMinRole(RoleId.MANAGER), controller.getStats);
 */
export function authorizeMinRole(minRoleId: RoleId) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Not authenticated');
      }

      // Lower role ID = higher role (admin = 1 is highest)
      if (req.user.role_id > minRoleId) {
        throw new AuthorizationError(`Requires role ${minRoleId} or higher`);
      }

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        res.status(403).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        logger.error('Unexpected error in authorizeMinRole middleware', error as Error, 'RBACMiddleware');
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  };
}

// Export RoleId for use in other modules
export { RoleId };
