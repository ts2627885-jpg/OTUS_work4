import jwt from 'jsonwebtoken';
import { MOCK_USERS } from './data';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

export interface IUser {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
}

export class MockAuthService {
  async login(username: string, password: string) {
    const user = MOCK_USERS.find(u => u.username === username) as (typeof MOCK_USERS)[number] & { password?: string } | undefined;

    if (!user || user.password !== password) {
      throw new Error('Invalid credentials');
    }

    const userWithoutPassword: IUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const token = jwt.sign(userWithoutPassword, JWT_SECRET, { expiresIn: '24h' });

    return {
      token,
      user: userWithoutPassword
    };
  }

  async register(data: { username: string; email: string; password: string }) {
    const existingUser = MOCK_USERS.find(u => u.username === data.username);

    if (existingUser) {
      throw new Error('User already exists');
    }

    const newUser: IUser = {
      id: Math.random().toString(36).substr(2, 9),
      username: data.username,
      email: data.email,
      role: 'viewer',
      permissions: ['view_analytics']
    };

    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '24h' });

    return {
      token,
      user: newUser
    };
  }

  async getUserProfile(userId: string) {
    const user = MOCK_USERS.find(u => u.id === userId);

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };
  }

  async refreshToken(userId: string) {
    const user = MOCK_USERS.find(u => u.id === userId);

    if (!user) {
      throw new Error('User not found');
    }

    const userWithoutPassword: IUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const token = jwt.sign(userWithoutPassword, JWT_SECRET, { expiresIn: '24h' });

    return { token };
  }

  verifyToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET) as IUser;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
