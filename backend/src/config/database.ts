/**
 * Database Configuration
 * Initializes PostgreSQL connection pool
 *
 * ✅ Connection pooling for performance
 * ✅ Configurable via environment variables
 * ✅ Proper error handling and logging
 */

import { Pool, PoolConfig } from 'pg';
import { logger } from '@utils/logger';

/**
 * Create database connection pool
 *
 * Environment variables:
 * - DB_HOST: Database host (default: localhost)
 * - DB_PORT: Database port (default: 5432)
 * - DB_USER: Database user (default: postgres)
 * - DB_PASSWORD: Database password (required in production)
 * - DB_NAME: Database name (default: azs_pult)
 * - DB_POOL_MAX: Max connections in pool (default: 20)
 * - DB_POOL_IDLE_TIMEOUT: Idle connection timeout in ms (default: 30000)
 */
export function createDatabasePool(): Pool {
  const poolConfig: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'azs_pult',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: 2000,
    application_name: 'azs-pult-backend'
  };

  logger.info('Initializing database pool', 'Database', {
    host: poolConfig.host,
    port: poolConfig.port,
    database: poolConfig.database,
    poolSize: poolConfig.max
  });

  const pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err: Error) => {
    logger.error('Unexpected error on idle client', err, 'Database');
  });

  // Test connection
  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      logger.error('Database connection test failed', err, 'Database');
    } else {
      logger.info('Database connection successful', 'Database', {
        timestamp: result.rows[0].now
      });
    }
  });

  return pool;
}

/**
 * Close database connection pool
 */
export async function closeDatabasePool(pool: Pool): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed', 'Database');
  } catch (error) {
    logger.error('Error closing database pool', error as Error, 'Database');
  }
}

/**
 * Single pool instance (lazy initialization)
 */
let pool: Pool | null = null;

/**
 * Get or create database pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = createDatabasePool();
  }
  return pool;
}
