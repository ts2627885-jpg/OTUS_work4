/**
 * Authentication Controller
 * Handles HTTP requests for authentication operations
 *
 * ✅ Controllers contain NO business logic
 * ✅ Controllers validate input, call services, return responses
 * ✅ Controllers handle HTTP concerns only (status codes, headers, body formatting)
 */

import { Request, Response } from 'express';
import { AuthService } from '@services/auth.service';
import { validate, authValidators } from '@utils/validators';
import { ILoginRequest, IRegisterRequest, ILoginResponse } from '@models/User';
import { logger } from '@utils/logger';

export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Login user with username and password
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const validated = await validate<ILoginRequest>(req.body, authValidators.login);

      logger.auth('Login attempt', { username: validated.username });

      const result = await this.authService.login(
        validated.username,
        validated.password
      );

      logger.info(`User logged in: ${result.user.id}`, 'AuthController');

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      // Errors are caught by global errorHandler middleware
      throw error;
    }
  }

  /**
   * POST /api/auth/register
   * Register new user
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const validated = await validate<IRegisterRequest>(req.body, authValidators.register);

      logger.auth('Registration attempt', { username: validated.username, email: validated.email });

      const result = await this.authService.register(validated);

      logger.info(`User registered: ${result.user.id}`, 'AuthController');

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * POST /api/auth/logout
   * Logout user (invalidates token on client side)
   * Note: JWT tokens are stateless, logout is primarily a client-side operation
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      logger.auth('Logout', { userId });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/auth/profile
   * Get current user profile
   * Requires authentication
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const user = await this.authService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh JWT token
   * Requires valid refresh token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const newToken = await this.authService.refreshToken(userId);

      res.status(200).json({
        success: true,
        data: newToken
      });
    } catch (error) {
      throw error;
    }
  }
}
