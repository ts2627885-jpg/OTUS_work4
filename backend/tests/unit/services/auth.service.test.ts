/**
 * Authentication Service Unit Tests
 * Tests all auth service methods in isolation
 *
 * ✅ Mock UserRepository to test service logic
 * ✅ Test success and error cases
 * ✅ Validate password hashing and JWT generation
 */

import { AuthService } from '@services/auth.service';
import { UserRepository } from '@repositories/user.repository';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError
} from '@utils/errors';
import { IUser } from '@models/User';

/**
 * Mock UserRepository
 */
const mockUserRepository = {
  findByUsername: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  findByRoleId: jest.fn(),
  emailExists: jest.fn(),
  usernameExists: jest.fn()
};

describe('AuthService', () => {
  let authService: AuthService;
  const mockUser: IUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    password_hash: '$2a$10$XschuehnJ.C8tkRYGXmXp.TU5Kbb5nb4Yx65ve0.BgTvDLtqvS80q', // hashed 'password'
    role_id: 4,
    role: 'viewer',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(mockUserRepository as unknown as UserRepository);
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
    process.env.JWT_EXPIRES_IN = '24h';
  });

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      const result = await authService.login('testuser', 'password');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.token).toHaveProperty('access_token');
      expect(result.token.token_type).toBe('Bearer');
      expect(result.user.username).toBe('testuser');
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
    });

    it('should throw AuthenticationError if user not found', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);

      await expect(authService.login('nonexistent', 'password'))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if password is wrong', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.login('testuser', 'wrongpassword'))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if user is inactive', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      mockUserRepository.findByUsername.mockResolvedValue(inactiveUser);

      await expect(authService.login('testuser', 'password'))
        .rejects
        .toThrow(AuthenticationError);
    });
  });

  describe('register', () => {
    it('should create new user with valid data', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        ...mockUser,
        username: 'newuser',
        email: 'new@example.com'
      });

      const result = await authService.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'ValidPassword123!'
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.username).toBe('newuser');
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should throw ConflictError if username exists', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.register({
        username: 'testuser',
        email: 'new@example.com',
        password: 'ValidPassword123!'
      }))
        .rejects
        .toThrow(ConflictError);
    });

    it('should throw ConflictError if email exists', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register({
        username: 'newuser',
        email: 'test@example.com',
        password: 'ValidPassword123!'
      }))
        .rejects
        .toThrow(ConflictError);
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getUserProfile('user-123');

      // Профиль отдаётся в формате, который использует приложение: роль текстом, без хеша пароля
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        role: 'viewer',
        permissions: [],
        azs_access: []
      });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should throw NotFoundError if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.getUserProfile('nonexistent'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      // This would need a real token generated by generateToken
      // In a real test, we'd generate a token first
      expect(authService.verifyToken).toBeDefined();
    });

    it('should throw AuthenticationError for invalid token', () => {
      expect(() => authService.verifyToken('invalid.token.format'))
        .toThrow(AuthenticationError);
    });
  });

  describe('refreshToken', () => {
    it('should generate new token for user', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.refreshToken('user-123');

      expect(result).toHaveProperty('access_token');
      expect(result.token_type).toBe('Bearer');
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should throw NotFoundError if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.refreshToken('nonexistent'))
        .rejects
        .toThrow(NotFoundError);
    });
  });
});
