/**
 * Запись предупреждений и ошибок в таблицу app_logs (миграция 015).
 * Нужна для Supabase: логи приложения видны в базе, их можно смотреть через SQL и дашборд.
 * Включается переменной LOG_TO_DB=true. Файловый журнал (logs/) работает всегда.
 *
 * Ошибка записи сюда намеренно не логируется: иначе получилась бы рекурсия.
 */
import type { Pool } from 'pg';
import { logger } from './logger';

interface SinkEntry {
  level: string;
  context?: string;
  message: string;
  data?: Record<string, any>;
  error?: { name: string; message: string };
}

export function enableDbLogSink(pool: Pool): void {
  logger.setSink((entry: SinkEntry) => {
    pool
      .query(
        `INSERT INTO app_logs (level, context, message, data, error_name, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.level,
          entry.context ?? null,
          entry.message,
          entry.data ? JSON.stringify(entry.data) : null,
          entry.error?.name ?? null,
          entry.error?.message ?? null,
        ]
      )
      .catch(() => undefined);
  });
}
