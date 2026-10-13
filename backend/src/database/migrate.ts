/**
 * Применение миграций из src/database/migrations (по порядку имён файлов).
 *
 * Команды (из backend/):
 *   npm run migrate                                применить все новые миграции
 *   npm run migrate -- --baseline                  отметить все миграции как применённые, ничего не выполняя
 *   npm run migrate -- --baseline=007_price_test_plan
 *                                                  отметить применёнными миграции до указанной включительно,
 *                                                  остальные выполнить (для базы, созданная вручную до журнала)
 *
 * Применённые миграции записываются в таблицу schema_migrations вместе с checksum файла.
 * Каждая миграция выполняется в транзакции: при ошибке она откатывается целиком.
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const DB_NAME = process.env.DB_NAME || 'azs_pult';
const BASELINE_ARG = process.argv.find(a => a.startsWith('--baseline'));
const BASELINE = BASELINE_ARG !== undefined;
const BASELINE_UPTO = BASELINE_ARG?.split('=')[1]; // без значения — отмечаются все миграции
const LOCK_KEY = 'azs_pult_migrations';

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // Без таймаута зависший запрос к удалённой базе висит бесконечно; DB_CONNECT_TIMEOUT — при медленном пулере
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 30000),
};

interface Migration {
  version: string;
  sql: string;
  checksum: string;
}

function loadMigrations(): Migration[] {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map(file => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      return {
        version: file.replace(/\.sql$/, ''),
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex'),
      };
    });
}

async function ensureDatabase() {
  if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
    throw new Error(`Недопустимое имя базы: ${DB_NAME}`);
  }
  const admin = new Pool({ ...connection, database: 'postgres' });
  try {
    await admin.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`База ${DB_NAME} создана`);
  } catch (error: any) {
    if (error.code !== '42P04') throw error; // 42P04 — база уже существует
  } finally {
    await admin.end();
  }
}

async function main() {
  await ensureDatabase();

  const pool = new Pool({ ...connection, database: DB_NAME });
  const client = await pool.connect();
  try {
    // Защита от одновременного запуска двух миграций
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    varchar(100) PRIMARY KEY,
        checksum   varchar(64) NOT NULL,
        applied_at timestamp NOT NULL DEFAULT now()
      )`);

    const { rows: appliedRows } = await client.query('SELECT version, checksum FROM schema_migrations');
    const applied = new Map(appliedRows.map(r => [r.version as string, r.checksum as string]));

    // База с таблицами, но без журнала миграций: накатывать 001 поверх нельзя
    if (applied.size === 0 && !BASELINE) {
      const { rows } = await client.query(`SELECT to_regclass('public.users') AS t`);
      if (rows[0].t) {
        throw new Error('База уже содержит таблицы, но не отмечена миграциями. ' +
          'Запустите "npm run migrate -- --baseline", если схема актуальна.');
      }
    }

    let count = 0;
    for (const m of loadMigrations()) {
      const known = applied.get(m.version);
      if (known) {
        if (known !== m.checksum) {
          console.warn(`⚠ ${m.version}: файл изменился после применения (checksum не совпадает)`);
        }
        continue;
      }

      if (BASELINE && (!BASELINE_UPTO || m.version <= BASELINE_UPTO)) {
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [m.version, m.checksum]);
        console.log(`отмечено как применённая: ${m.version}`);
        count++;
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [m.version, m.checksum]);
        await client.query('COMMIT');
        console.log(`применена: ${m.version}`);
        count++;
      } catch (error: any) {
        await client.query('ROLLBACK');
        throw new Error(`${m.version}: ${error.message}`);
      }
    }

    console.log(count ? `✅ Готово: обработано миграций — ${count}` : '✅ Новых миграций нет');
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('❌ Миграция не выполнена:', error.message);
  process.exit(1);
});
