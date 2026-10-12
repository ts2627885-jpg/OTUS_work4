/**
 * Centralized logging utility
 * Structured logging with JSON format for production.
 * Все записи дополнительно пишутся в файл logs/app-ГГГГ-ММ-ДД.log (каталог: LOG_DIR).
 */
import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const logDir = () => process.env.LOG_DIR || path.resolve(__dirname, '../../logs');

/** Удаляет файлы логов старше LOG_RETENTION_DAYS (по умолчанию 90) */
export function pruneLogFiles(): number {
  const keepDays = Number(process.env.LOG_RETENTION_DAYS || 90);
  const dir = logDir();
  if (!fs.existsSync(dir)) return 0;
  const cutoff = Date.now() - keepDays * 86400000;
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!/^app-\d{4}-\d{2}-\d{2}(\.\d+)?\.log$/.test(f)) continue;
    const full = path.join(dir, f);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full);
      removed++;
    }
  }
  return removed;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Format and output log entry
   */
  private log(level: LogLevel, message: string, context?: string, data?: any, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    if (data) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined
      };
    }

    this.writeFile(entry);

    if (this.isDevelopment) {
      // Development: pretty print
      const levelColors = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m'  // red
      };
      const reset = '\x1b[0m';
      const color = levelColors[level];

      const prefix = `${color}[${level.toUpperCase()}]${reset}`;
      const contextStr = context ? ` [${context}]` : '';
      const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
      const errorStr = error ? `\n${error.stack}` : '';

      console.log(`${prefix}${contextStr} ${message}${dataStr}${errorStr}`);
    } else {
      // Production: JSON format
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Запись в файл: logs/app-ГГГГ-ММ-ДД.log; при превышении LOG_MAX_MB создаётся app-ГГГГ-ММ-ДД.N.log.
   * Сбой записи не должен ломать приложение.
   */
  private writeFile(entry: LogEntry): void {
    try {
      const dir = logDir();
      fs.mkdirSync(dir, { recursive: true });
      const day = entry.timestamp.slice(0, 10);
      const maxBytes = Number(process.env.LOG_MAX_MB || 20) * 1024 * 1024;
      let file = path.join(dir, `app-${day}.log`);
      for (let n = 1; fs.existsSync(file) && fs.statSync(file).size >= maxBytes; n++) {
        file = path.join(dir, `app-${day}.${n}.log`);
      }
      fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    } catch {
      // игнорируем: журнал не должен валить запрос
    }
  }

  debug(message: string, context?: string, data?: any): void {
    this.log('debug', message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log('info', message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log('warn', message, context, data);
  }

  error(message: string, error?: Error, context?: string, data?: any): void {
    this.log('error', message, context, data, error);
  }

  /**
   * Log with request context
   */
  httpRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.info(`${method} ${path} - ${statusCode}`, 'HTTP', { duration_ms: duration });
  }

  /**
   * Log database query
   */
  query(query: string, params?: unknown[], duration?: number): void {
    if (this.isDevelopment) {
      this.debug(`Query executed${duration !== undefined ? ` in ${duration}ms` : ''}`, 'DATABASE', { query, params });
    }
  }

  /**
   * Log authentication event
   */
  auth(event: string, userId?: unknown, details?: any): void {
    this.info(`User ${event}`, 'AUTH', { userId, ...details });
  }
}

// Export singleton instance
export const logger = new Logger();

// очистка старых файлов при старте и раз в сутки
try {
  pruneLogFiles();
  setInterval(() => pruneLogFiles(), 86400000).unref();
} catch {
  // очистка не должна мешать запуску
}
