/**
 * Синхронизация схемы public (приложение) со схемой azs (аналитика).
 * Использует тот же скрипт, что и пайплайн: _data/_BD/pipeline/sync_public.sql.
 * Вызывается после загрузки CSV через интерфейс, чтобы новые АЗС появлялись в пульте.
 */
import fs from 'fs';
import path from 'path';
import { getPool } from '@config/database';
import { logger } from '@utils/logger';

export interface PublicSyncResult {
  added: string[];    // названия АЗС, появившиеся в приложении
  removed: string[];  // названия АЗС, удалённые из приложения (нет в аналитике)
  total: number;      // всего АЗС в приложении после синхронизации
}

// backend/src/services -> корень azs-pult-fullstack (то же и из dist/services)
// В контейнере файл лежит в другом месте: путь задаётся переменной SYNC_PUBLIC_SQL
const SYNC_SQL = process.env.SYNC_PUBLIC_SQL || path.resolve(__dirname, '../../../_data/_BD/pipeline/sync_public.sql');

async function appStationNames(): Promise<string[]> {
  const { rows } = await getPool().query(`SELECT name FROM public.azs ORDER BY name`);
  return rows.map((r: { name: string }) => r.name);
}

export async function syncPublic(): Promise<PublicSyncResult> {
  const before = new Set(await appStationNames());
  const sql = fs.readFileSync(SYNC_SQL, 'utf-8');
  const client = await getPool().connect();
  try {
    // Скрипт сам открывает и закрывает транзакцию; при ошибке откатываем явно, иначе соединение вернётся в пул открытым
    await client.query(sql);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.error('Синхронизация public не выполнена', e as Error, 'SYNC');
    throw e;
  } finally {
    client.release();
  }
  const after = await appStationNames();
  const afterSet = new Set(after);
  const result: PublicSyncResult = {
    added: after.filter((n) => !before.has(n)),
    removed: [...before].filter((n) => !afterSet.has(n)),
    total: after.length
  };
  logger.info('Синхронизация public выполнена', 'SYNC', result);
  return result;
}
