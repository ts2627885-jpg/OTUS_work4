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
import { currentClient } from './request-context';

/** Обязательная переменная окружения: без неё приложение не стартует, а не подключается с паролем по умолчанию */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Переменная ${name} не задана (см. backend/.env.example)`);
  }
  return value;
}

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
 * - DB_CONNECT_TIMEOUT: Timeout for acquiring a connection in ms (default: 10000)
 * - DB_POOL_IDLE_TIMEOUT: Idle connection timeout in ms (default: 600000). Удалённая база: переподключения медленные, держим соединения дольше
 */
export function createDatabasePool(): Pool {
  const poolConfig: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: requireEnv('DB_PASSWORD'),
    database: process.env.DB_NAME || 'azs_pult',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '600000', 10),
    keepAlive: true,
    // Удалённая база (Supabase) может долго устанавливать соединение; 2 с было мало
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
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
 * Get or create the underlying pool (без контекста запроса; используется middleware и фоновым кодом)
 */
export function getRawPool(): Pool {
  if (!pool) {
    pool = createDatabasePool();
  }
  return pool;
}

/**
 * Пул для кода приложения. Внутри запроса все запросы идут через соединение запроса,
 * где выставлен контекст пользователя для RLS. Вне запроса — через обычный пул.
 * Интерфейс совпадает с Pool (query и connect), поэтому репозитории и сервисы не меняются.
 */
export function getPool(): Pool {
  const scoped = {
    query: (...args: any[]) => {
      const client = currentClient();
      return ((client ?? getRawPool()) as any).query(...args);
    },
    connect: async () => {
      const client = currentClient();
      if (client) {
        // Внутри запроса освобождать соединение нельзя: его вернёт middleware
        return { query: (...args: any[]) => (client as any).query(...args), release: () => undefined } as any;
      }
      return getRawPool().connect();
    }
  };
  return scoped as unknown as Pool;
}
