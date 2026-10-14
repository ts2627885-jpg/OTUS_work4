/**
 * Контекст RLS для запроса (config/request-context).
 * Позитивный сценарий: привязка пользователя выполняется одним запросом с его id.
 * Ошибка: некорректный id не даёт роли; вне запроса соединения нет и запроса не делаем.
 */
import { requestScope, bindUserContext } from '@config/request-context';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NO_USER_ID = '00000000-0000-0000-0000-000000000000';

function fakeClient() {
  return { query: jest.fn().mockResolvedValue({ rows: [] }) };
}

describe('bindUserContext', () => {
  it('привязывает пользователя одним запросом', async () => {
    const client = fakeClient();
    await requestScope.run({ client: client as never }, () => bindUserContext(USER_ID));
    expect(client.query).toHaveBeenCalledTimes(1);
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain("set_config('app.role'");
    expect(sql).toContain('FROM users');
    expect(params).toEqual([USER_ID, USER_ID]);
  });

  it('некорректный id заменяется нулевым UUID и не даёт user_id', async () => {
    const client = fakeClient();
    await requestScope.run({ client: client as never }, () =>
      bindUserContext('не-uuid; drop table users')
    );
    const [, params] = client.query.mock.calls[0];
    expect(params).toEqual([NO_USER_ID, '']);
  });

  it('вне запроса соединения нет: запрос не выполняется', async () => {
    await expect(bindUserContext(USER_ID)).resolves.toBeUndefined();
  });
});
