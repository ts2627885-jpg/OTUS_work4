/**
 * Доступ к станциям (services/access.service).
 * Позитивный сценарий: admin, analyst, viewer видят все станции; manager — только назначенные.
 * Ошибка: деактивированный пользователь (роль null) и неизвестная роль не получают доступа.
 */
const mockQuery = jest.fn();
jest.mock('@config/database', () => ({
  getPool: () => ({ query: mockQuery }),
}));

import { accessibleStationIds, canAccessStation, clientIp } from '@services/access.service';
import type { Request } from 'express';

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

describe('clientIp', () => {
  // req.ip Express вычисляет с учётом trust proxy; заголовок X-Forwarded-For клиент может подделать
  const fakeReq = (ip: string | undefined, forwardedFor?: string) =>
    ({
      ip,
      headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      socket: { remoteAddress: '127.0.0.9' },
    }) as unknown as Request;

  it('берёт адрес из req.ip и игнорирует подменённый X-Forwarded-For', () => {
    expect(clientIp(fakeReq('203.0.113.7', '1.2.3.4'))).toBe('203.0.113.7');
  });

  it('без req.ip использует адрес сокета', () => {
    expect(clientIp(fakeReq(undefined))).toBe('127.0.0.9');
  });
});
