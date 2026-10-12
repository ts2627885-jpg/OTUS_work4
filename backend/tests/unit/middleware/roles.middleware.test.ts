/**
 * Проверка ролей (middleware/roles.middleware).
 * Позитивные: нужная роль пропускается. Ошибки: другая роль, неверный id, нет пользователя, сбой БД.
 */
import { requireRole, currentRole } from '@middleware/roles.middleware';

const mockQuery = jest.fn();
jest.mock('@config/database', () => ({ getPool: () => ({ query: mockQuery }) }));

const VALID_ID = '2aeb3529-8548-472a-aa54-0c4ca3b083e5';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('requireRole', () => {
  beforeEach(() => mockQuery.mockReset());

  describe('позитивные сценарии', () => {
    it('пропускает администратора на маршрут для администраторов', async () => {
      mockQuery.mockResolvedValue({ rows: [{ role: 'admin' }] });
      const next = jest.fn();

      await requireRole(['admin'])({ user: { id: VALID_ID } } as any, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });

    it('пропускает менеджера, если он входит в список допустимых ролей', async () => {
      mockQuery.mockResolvedValue({ rows: [{ role: 'manager' }] });
      const next = jest.fn();

      await requireRole(['admin', 'manager'])({ user: { id: VALID_ID } } as any, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('обработка ошибок', () => {
    it('отвечает 403, если роль не подходит', async () => {
      mockQuery.mockResolvedValue({ rows: [{ role: 'viewer' }] });
      const res = makeRes();
      const next = jest.fn();

      await requireRole(['admin'])({ user: { id: VALID_ID } } as any, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('отвечает 403 без запроса к БД, если идентификатор пользователя неверный', async () => {
      const res = makeRes();

      await requireRole(['admin'])({ user: { id: 'not-a-uuid' } } as any, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('отвечает 403, если пользователь не найден в базе', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const res = makeRes();

      await requireRole(['admin'])({ user: { id: VALID_ID } } as any, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('передаёт ошибку БД в next, а не отвечает пользователю', async () => {
      const dbError = new Error('connection lost');
      mockQuery.mockRejectedValue(dbError);
      const next = jest.fn();

      await requireRole(['admin'])({ user: { id: VALID_ID } } as any, makeRes(), next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});

describe('currentRole', () => {
  beforeEach(() => mockQuery.mockReset());

  it('возвращает null без пользователя в запросе', async () => {
    expect(await currentRole({} as any)).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
