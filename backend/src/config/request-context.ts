/**
 * Контекст запроса к базе для Row Level Security.
 *
 * На каждый запрос /api берётся отдельное соединение из пула. В нём выставляются
 * app.role и app.user_id (set_config на уровне сессии), по ним политики RLS решают,
 * какие строки видны. Все запросы внутри запроса идут через это соединение.
 * Перед возвратом в пул настройки сбрасываются.
 */
import { AsyncLocalStorage } from 'async_hooks';
import type { PoolClient } from 'pg';

interface RequestScope {
  client: PoolClient;
}

export const requestScope = new AsyncLocalStorage<RequestScope>();

/** Соединение текущего запроса или undefined вне запроса (фоновый код, скрипты) */
export function currentClient(): PoolClient | undefined {
  return requestScope.getStore()?.client;
}

/** Передать роль и id пользователя в контекст текущего запроса */
export async function bindUserContext(userId: string): Promise<void> {
  const client = currentClient();
  if (!client) return;
  // Некорректный id не даёт роли: политики RLS тогда закроют всё (отказ по умолчанию)
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  let role = '';
  if (valid) {
    // Чтение users разрешено любому контексту (см. 010_rls): нужно для входа и проверки роли
    const { rows } = await client.query('SELECT role FROM users WHERE id = $1 AND is_active', [userId]);
    role = rows[0]?.role ?? '';
  }
  await client.query(
    "SELECT set_config('app.role', $1, false), set_config('app.user_id', $2, false)",
    [role, valid ? userId : '']
  );
}
