/**
 * Резервные копии базы (pg_dump, формат custom). Хранятся последние KEEP_BACKUPS файлов.
 * Параметры подключения — те же, что у пула (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 * Путь к pg_dump задаётся PG_DUMP_PATH: версия утилиты должна совпадать с версией сервера.
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from '@utils/logger';

const backupDir = () => process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups');
const keep = () => Number(process.env.KEEP_BACKUPS || 10);

export interface BackupInfo { file: string; size: number; createdAt: string }

/** Создаёт дамп базы или только схемы (schema), возвращает путь к файлу */
export function createBackup(reason: string, schema?: string): Promise<string> {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const dbName = process.env.DB_NAME || 'azs_pult';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_');
  const file = path.join(dir, `${dbName}${schema ? '_' + schema : ''}_${stamp}_${safeReason}.dump`);
  const args = [
    '-h', process.env.DB_HOST || 'localhost',
    '-p', process.env.DB_PORT || '5432',
    '-U', process.env.DB_USER || 'postgres',
    '-Fc', '-f', file,
    ...(schema ? ['-n', schema] : []),
    dbName
  ];
  const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' };
  return new Promise((resolve, reject) => {
    execFile(process.env.PG_DUMP_PATH || 'pg_dump', args, { env }, (err, _out, stderr) => {
      if (err) {
        logger.error('Резервная копия не создана', err, 'BACKUP', { reason, stderr: String(stderr || '').slice(0, 500) });
        return reject(new Error('Не удалось создать резервную копию: ' + (stderr || err.message)));
      }
      const size = fs.statSync(file).size;
      logger.info('Резервная копия создана', 'BACKUP', { file, size, reason, schema: schema || 'all' });
      prune(dbName);
      resolve(file);
    });
  });
}

/** Удаляет старые копии базы, оставляя KEEP_BACKUPS последних */
function prune(dbName: string) {
  const files = listBackups().filter(b => path.basename(b.file).startsWith(dbName + '_') || path.basename(b.file).startsWith(dbName + '.'));
  files.slice(keep()).forEach(b => {
    try {
      fs.unlinkSync(b.file);
      logger.info('Старая резервная копия удалена', 'BACKUP', { file: b.file });
    } catch (e: any) {
      logger.warn('Не удалось удалить старую копию', 'BACKUP', { file: b.file, error: e.message });
    }
  });
}

/** Список копий, от новых к старым */
export function listBackups(): BackupInfo[] {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.dump'))
    .map(f => {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      return { file: full, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
