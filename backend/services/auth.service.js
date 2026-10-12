const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

class AuthService {
  async register(username, email, password, roleId = 4) { // 4 = viewer по умолчанию
    try {
      // Проверить, не существует ли пользователь
      const exists = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (exists.rows.length > 0) {
        throw new Error('User already exists');
      }

      // Хеш пароля
      const hashedPassword = await bcrypt.hash(password, 10);

      // Создать пользователя
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, role_id`,
        [username, email, hashedPassword, roleId]
      );

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  async login(username, password) {
    try {
      // Найти пользователя
      const result = await pool.query(
        `SELECT u.*, r.name as role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.username = $1 AND u.is_active = TRUE`,
        [username]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];

      // Проверить пароль
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        throw new Error('Invalid credentials');
      }

      // Получить права доступа
      const perms = await pool.query(
        `SELECT p.name FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = $1`,
        [user.role_id]
      );

      // Записать логин
      await pool.query(
        `UPDATE users SET last_login = NOW() WHERE id = $1`,
        [user.id]
      );

      // Создать JWT
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role_name,
          permissions: perms.rows.map(p => p.name)
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role_name,
          firstName: user.first_name,
          lastName: user.last_name
        }
      };
    } catch (error) {
      throw error;
    }
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

module.exports = new AuthService();
