/**
 * User Repository (Data Access Layer)
 * Handles ALL database queries for users
 *
 * ✅ Parameterized queries ALWAYS (prevents SQL injection)
 * ✅ No business logic here
 * ✅ Single responsibility: database operations only
 * ✅ Queries are logged for debugging
 */

import { Pool, QueryResult } from 'pg';
import { IUser } from '@models/User';
import { logger } from '@utils/logger';

export class UserRepository {
  constructor(private db: Pool) {}

  /**
   * Find user by ID
   *
   * @param id - User ID
   * @returns User object or null if not found
   */
  async findById(id: string): Promise<IUser | null> {
    const query = 'SELECT * FROM users WHERE id = $1';

    logger.query(query, [id]);

    const result: QueryResult<IUser> = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find user by username
   *
   * @param username - Username
   * @returns User object or null if not found
   */
  async findByUsername(username: string): Promise<IUser | null> {
    const query = 'SELECT * FROM users WHERE username = $1';

    logger.query(query, [username]);

    const result: QueryResult<IUser> = await this.db.query(query, [username]);
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   *
   * @param email - Email address
   * @returns User object or null if not found
   */
  async findByEmail(email: string): Promise<IUser | null> {
    const query = 'SELECT * FROM users WHERE email = $1';

    logger.query(query, [email]);

    const result: QueryResult<IUser> = await this.db.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Get all users with pagination
   *
   * @param limit - Number of records to return
   * @param offset - Number of records to skip
   * @returns Array of users
   */
  async findAll(limit: number = 20, offset: number = 0): Promise<IUser[]> {
    const query = 'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2';

    logger.query(query, [limit, offset]);

    const result: QueryResult<IUser> = await this.db.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Create new user
   *
   * @param userData - User data
   * @returns Created user object
   */
  async create(userData: Omit<IUser, 'id'>): Promise<IUser> {
    const query = `
      INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    // В таблице users роль хранится текстом (admin/manager/analyst/viewer), а не role_id
    const values = [
      userData.username,
      userData.email,
      userData.password_hash,
      userData.role ?? 'viewer',
      userData.is_active,
      userData.created_at,
      userData.updated_at
    ];

    logger.query(query, values);

    const result: QueryResult<IUser> = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update user
   *
   * @param id - User ID
   * @param updateData - Fields to update
   * @returns Updated user object
   */
  async update(
    id: string,
    updateData: Partial<Omit<IUser, 'id' | 'created_at'>>
  ): Promise<IUser | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updateData.username !== undefined) {
      fields.push(`username = $${paramIndex++}`);
      values.push(updateData.username);
    }

    if (updateData.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updateData.email);
    }

    if (updateData.password_hash !== undefined) {
      fields.push(`password_hash = $${paramIndex++}`);
      values.push(updateData.password_hash);
    }

    if (updateData.role_id !== undefined) {
      fields.push(`role_id = $${paramIndex++}`);
      values.push(updateData.role_id);
    }

    if (updateData.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updateData.is_active);
    }

    // Always update updated_at
    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(id); // For WHERE clause

    if (fields.length === 1) { // Only updated_at
      return this.findById(id);
    }

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    logger.query(query, values);

    const result: QueryResult<IUser> = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete user
   *
   * @param id - User ID
   * @returns True if user was deleted
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';

    logger.query(query, [id]);

    const result = await this.db.query(query, [id]);
    return result.rowCount! > 0;
  }

  /**
   * Count total users
   *
   * @returns Total number of users
   */
  async count(): Promise<number> {
    const query = 'SELECT COUNT(*) FROM users';

    logger.query(query, []);

    const result: QueryResult<{ count: string }> = await this.db.query(query);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Find users by role ID
   *
   * @param roleId - Role ID
   * @param limit - Pagination limit
   * @param offset - Pagination offset
   * @returns Array of users with given role
   */
  async findByRoleId(roleId: number, limit: number = 20, offset: number = 0): Promise<IUser[]> {
    const query = `
      SELECT * FROM users
      WHERE role_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    logger.query(query, [roleId, limit, offset]);

    const result: QueryResult<IUser> = await this.db.query(query, [roleId, limit, offset]);
    return result.rows;
  }

  /**
   * Check if email exists
   *
   * @param email - Email to check
   * @returns True if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const query = 'SELECT 1 FROM users WHERE email = $1 LIMIT 1';

    logger.query(query, [email]);

    const result = await this.db.query(query, [email]);
    return result.rows.length > 0;
  }

  /**
   * Check if username exists
   *
   * @param username - Username to check
   * @returns True if username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    const query = 'SELECT 1 FROM users WHERE username = $1 LIMIT 1';

    logger.query(query, [username]);

    const result = await this.db.query(query, [username]);
    return result.rows.length > 0;
  }
}
