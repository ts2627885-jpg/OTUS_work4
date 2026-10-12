/**
 * Authentication Integration Tests
 * Tests full auth flow: Controller → Service → Repository → Database
 *
 * ✅ Uses real database (test instance)
 * ✅ Tests complete request/response cycle
 * ✅ Validates HTTP status codes and response formats
 */

import request from 'supertest';
import { createApp } from '@/server';
import { getPool } from '@config/database';
import { Express } from 'express';

describe('Authentication Endpoints', () => {
  let app: Express;
  const db = getPool();

  beforeAll(async () => {
    app = createApp();
  });

  // Каждый тест начинается с чистого состояния: тестовые пользователи (домен example.com) удаляются после теста,
  // иначе повторная регистрация одного и того же логина в beforeEach даёт 409
  const cleanTestUsers = () => db.query(`DELETE FROM users WHERE email LIKE '%@example.com'`);

  afterEach(async () => {
    await cleanTestUsers();
  });

  afterAll(async () => {
    await cleanTestUsers();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser123',
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.username).toBe('testuser123');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 409 if username already exists', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicate',
          email: 'email1@example.com',
          password: 'TestPassword123!'
        });

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicate',
          email: 'email2@example.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'logintest',
          email: 'login@example.com',
          password: 'TestPassword123!'
        });
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'logintest',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.token).toHaveProperty('access_token');
      expect(response.body.data.token.token_type).toBe('Bearer');
      expect(response.body.data.user.username).toBe('logintest');
    });

    it('should return 401 with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'logintest',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 if user not found', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'Password123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/profile', () => {
    let token: string;

    beforeEach(async () => {
      // Register and get token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'profiletest',
          email: 'profile@example.com',
          password: 'TestPassword123!'
        });

      token = registerResponse.body.data.token.access_token;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.username).toBe('profiletest');
      expect(response.body.data).not.toHaveProperty('password_hash');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 with missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', token);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let token: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'refreshtest',
          email: 'refresh@example.com',
          password: 'TestPassword123!'
        });

      token = registerResponse.body.data.token.access_token;
    });

    it('should refresh token with valid token', async () => {
      // JWT содержит iat в секундах: без паузы новый токен совпадает со старым, и проверка «токен другой» падает
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('access_token');
      expect(response.body.data.token_type).toBe('Bearer');
      // New token should be different
      expect(response.body.data.access_token).not.toBe(token);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    let token: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'logouttest',
          email: 'logout@example.com',
          password: 'TestPassword123!'
        });

      token = registerResponse.body.data.token.access_token;
    });

    it('should logout with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
