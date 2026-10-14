/**
 * Синхронизация public (services/public-sync.service).
 * Позитивный сценарий: список АЗС до и после, новые и удалённые станции.
 * Ошибка: сбой SQL откатывает транзакцию и не оставляет соединение открытым.
 */
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockClientQuery = jest.fn();
jest.mock('@config/database', () => ({
  getPool: () => ({
    query: mockQuery,
    connect: async () => ({ query: mockClientQuery, release: mockRelease }),
  }),
}));

import { syncPublic } from '@services/public-sync.service';

describe('syncPublic', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockClientQuery.mockReset();
    mockRelease.mockReset();
  });

  it('сообщает о добавленных и удалённых АЗС', async () => {
    // до синхронизации: 172 и 121; после: 121 и 122
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: 'АЗС 121' }, { name: 'АЗС 172' }] })
      .mockResolvedValueOnce({ rows: [{ name: 'АЗС 121' }, { name: 'АЗС 122' }] });
    mockClientQuery.mockResolvedValue({ rows: [] });

    const result = await syncPublic();

    expect(result).toEqual({ added: ['АЗС 122'], removed: ['АЗС 172'], total: 2 });
    expect(mockRelease).toHaveBeenCalled();
  });

  it('при ошибке SQL откатывает транзакцию и освобождает соединение', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockClientQuery
      .mockRejectedValueOnce(new Error('столбец не существует')) // сам скрипт
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(syncPublic()).rejects.toThrow('столбец не существует');

    expect(mockClientQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(mockRelease).toHaveBeenCalled();
  });
});
