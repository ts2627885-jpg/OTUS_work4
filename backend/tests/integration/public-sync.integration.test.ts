/**
 * Синхронизация public на реальной базе: станции, созданные вручную, не удаляются.
 * Проверяется то, что раньше терялось: ручная станция сохраняется после синхронизации,
 * а станции из аналитики по-прежнему приходят из azs.
 */
import { getPool, closeDatabasePool } from '@config/database';
import { syncPublic } from '@services/public-sync.service';

const MANUAL_NAME = 'АЗС ручная (тест)';

describe('syncPublic: ручные станции', () => {
  const db = getPool();

  afterAll(async () => {
    await db.query('DELETE FROM public.azs WHERE name = $1', [MANUAL_NAME]);
    await closeDatabasePool(db);
  });

  it('сохраняет станцию, созданную вручную (source = manual), и помечает станции аналитики', async () => {
    // имитация создания через API: без явного source берётся значение по умолчанию 'manual'
    await db.query(
      `INSERT INTO public.azs (name, address, region, fuel_types, status)
       VALUES ($1, 'Ручной адрес', 'Tver region', ARRAY['A92'], 'active')`,
      [MANUAL_NAME]
    );

    await syncPublic();

    const { rows } = await db.query(
      `SELECT name, source FROM public.azs WHERE name = $1 OR source = 'analytics' ORDER BY name`,
      [MANUAL_NAME]
    );
    const manual = rows.find((r) => r.name === MANUAL_NAME);
    expect(manual).toBeDefined();
    expect(manual.source).toBe('manual');
    // станции из аналитики остаются и помечены как analytics
    expect(rows.filter((r) => r.source === 'analytics').length).toBeGreaterThan(0);
  });
});
