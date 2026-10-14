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
// Некорректный id подменяем нулевым UUID: поиск ничего не найдёт, роль станет пустой (отказ по умолчанию)
const NO_USER_ID = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function bindUserContext(userId: string): Promise<void> {
  const client = currentClient();
  if (!client) return;
  const valid = UUID_RE.test(userId);
  // Один запрос вместо двух: роль ищем и тут же ставим контекст. Поиск идёт до установки роли,
  // поэтому выполняется под текущим контекстом (политика users_select разрешает чтение anonymous).
  await client.query(
    `SELECT set_config('app.role', COALESCE((SELECT role FROM users WHERE id = $1 AND is_active), ''), false) AS role_set,
            set_config('app.user_id', $2, false) AS user_set`,
    [valid ? userId : NO_USER_ID, valid ? userId : '']
  );
}
