/**
 * Доступ к станциям (services/access.service).
 * Позитивный сценарий: admin, analyst, viewer видят все станции; manager — только назначенные.
 * Ошибка: деактивированный пользователь (роль null) и неизвестная роль не получают доступа.
 */
const mockQuery = jest.fn();
jest.mock('@config/database', () => ({
  getPool: () => ({ query: mockQuery }),
}));

import { accessibleStationIds, canAccessStation } from '@services/access.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STATION_ID = '22222222-2222-4222-8222-222222222222';

describe('accessibleStationIds', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it.each(['admin', 'analyst', 'viewer'])('роль %s видит все станции', async (role) => {
    expect(await accessibleStationIds({ id: USER_ID, role })).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('менеджер видит только назначенные станции', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ azs_id: STATION_ID }] });
    expect(await accessibleStationIds({ id: USER_ID, role: 'manager' })).toEqual([STATION_ID]);
  });

  it('деактивированный пользователь (роль null) не получает станций', async () => {
    expect(await accessibleStationIds({ id: USER_ID, role: null })).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('неизвестная роль не получает станций', async () => {
    expect(await accessibleStationIds({ id: USER_ID, role: 'superuser' })).toEqual([]);
  });
});

describe('canAccessStation', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('деактивированный пользователь не может открыть станцию', async () => {
    expect(await canAccessStation({ id: USER_ID, role: null }, STATION_ID)).toBe(false);
  });

  it('viewer может открыть любую станцию', async () => {
    expect(await canAccessStation({ id: USER_ID, role: 'viewer' }, STATION_ID)).toBe(true);
  });
});
