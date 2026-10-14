/**
 * Authentication Service
 * Handles all authentication business logic
 *
 * ✅ Services contain ALL business logic
 * ✅ Services coordinate between repositories
 * ✅ Services validate business rules
 * ✅ Services are database-agnostic
 */

import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UserRepository } from '@repositories/user.repository';
import {
  IUser,
  ILoginResponse,
  IRegisterRequest,
  IAuthPayload,
  IUserResponse,
  UserRole,
} from '@models/User';
import { AuthenticationError, ConflictError, NotFoundError } from '@utils/errors';
import { logger } from '@utils/logger';

export class AuthService {
  private jwtSecret: string;
  private jwtExpiration: string;
  private passwordSaltRounds = 12;

  constructor(private userRepository: UserRepository) {
    // Без значения по умолчанию: токены, подписанные известным ключом, можно подделать
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET не задан или короче 32 символов (см. backend/.env.example)');
    }
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiration = process.env.JWT_EXPIRES_IN || '24h';

    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      logger.warn('JWT_SECRET not set in production environment!', 'AuthService');
    }
  }

  /**
   * Login user with username and password
   *
   * @param username - User's username
   * @param password - User's plain password (will be hashed for comparison)
   * @returns User data and JWT token
   * @throws AuthenticationError if credentials are invalid
   */
  async login(username: string, password: string): Promise<ILoginResponse> {
    // Find user by username
    const user = await this.userRepository.findByUsername(username);

    if (!user) {
      logger.warn(`Login failed: user not found`, 'AuthService', { username });
      throw new AuthenticationError('Invalid credentials');
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      logger.warn(`Login failed: invalid password`, 'AuthService', { username });
      throw new AuthenticationError('Invalid credentials');
    }

    if (!user.is_active) {
      logger.warn(`Login failed: user inactive`, 'AuthService', { username });
      throw new AuthenticationError('Account is disabled');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    logger.info(`User authenticated successfully`, 'AuthService', { userId: user.id });

    return {
      token: {
        access_token: token,
        token_type: 'Bearer',
        expires_in: this.jwtExpiration,
      },
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Register new user
   *
   * @param data - Registration data (username, email, password)
   * @returns New user data and JWT token
   * @throws ConflictError if username or email already exists
   * @throws ValidationError if password doesn't meet requirements
   */
  async register(data: IRegisterRequest): Promise<ILoginResponse> {
    // Check if username exists
    const existingUsername = await this.userRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError('Логин уже занят', 'USERNAME_EXISTS');
    }

    // Check if email exists
    const existingEmail = await this.userRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('Email уже зарегистрирован', 'EMAIL_EXISTS');
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.password, this.passwordSaltRounds);

    // Create user (default role: viewer)
    const newUser = await this.userRepository.create({
      username: data.username,
      email: data.email,
      password_hash,
      role_id: 4, // viewer role (default for new users)
      role: 'viewer',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info(`New user registered`, 'AuthService', { userId: newUser.id });

    // Generate token
    const token = this.generateToken(newUser);

    return {
      token: {
        access_token: token,
        token_type: 'Bearer',
        expires_in: this.jwtExpiration,
      },
      user: this.formatUserResponse(newUser),
    };
  }

  /**
   * Get user profile by ID
   *
   * @param userId - User ID
   * @returns User profile data
   * @throws NotFoundError if user doesn't exist
   */
  async getUserProfile(userId: string): Promise<IUserResponse> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', 'USER_NOT_FOUND');
    }

    return this.formatUserResponse(user);
  }

  /**
   * Refresh JWT token for user
   *
   * @param userId - User ID
   * @returns New JWT token
   * @throws NotFoundError if user doesn't exist
   */
  async refreshToken(
    userId: string
  ): Promise<{ access_token: string; token_type: string; expires_in: string }> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', 'USER_NOT_FOUND');
    }

    const newToken = this.generateToken(user);

    logger.info(`Token refreshed`, 'AuthService', { userId });

    return {
      access_token: newToken,
      token_type: 'Bearer',
      expires_in: this.jwtExpiration,
    };
  }

  /**
   * Verify and decode JWT token
   *
   * @param token - JWT token
   * @returns Decoded token payload
   * @throws AuthenticationError if token is invalid or expired
   */
  verifyToken(token: string): IAuthPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as IAuthPayload;
      return decoded;
    } catch (error) {
      logger.warn(`Token verification failed`, 'AuthService', { error: (error as Error).message });
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  /**
   * Generate JWT token for user
   *
   * @param user - User object
   * @returns JWT token string
   */
  private generateToken(user: IUser): string {
    const payload: IAuthPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role_id: user.role_id,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiration as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    });
  }

  /**
   * Format user object for API response
   * Removes sensitive fields like password_hash
   *
   * @param user - User object from database
   * @returns Formatted user response
   */
  private formatUserResponse(user: IUser): IUserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role as UserRole,
      permissions: user.permissions ?? [],
      azs_access: user.azs_access ?? [],
    };
  }
}
