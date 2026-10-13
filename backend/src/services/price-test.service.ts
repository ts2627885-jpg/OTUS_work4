/**
 * План контролируемого теста цен (PRICE-004): уровни цены по видам топлива и станциям.
 * Уровни смещения: −1.0, −0.5, 0, +0.5, +1.0 ₽ от текущей цены; каждый уровень на каждой паре
 * станция–топливо встречается по два раза (10 блоков по 2 дня). Порядок уровней случайный
 * и независим между станциями, чтобы эффект цены не смешивался с общими движениями сети.
 * План сохраняется как черновик (status = 'draft'): цены на станциях этим не меняются.
 */
import { getPool } from '@config/database';

const LEVELS = [-1.0, -0.5, 0, 0.5, 1.0];
const BLOCKS = 10;
const BLOCK_DAYS = 2;

/** Детерминированный генератор (mulberry32), чтобы план можно было воспроизвести по seed */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function buildDraftPlan(userId: string | null, seed = 42) {
  const pool = getPool();
  const { rows: prices } = await pool.query(
    `SELECT DISTINCT ON (station_code, fuel_code) station_code, fuel_code, price::float AS price
       FROM azs.fuel_daily WHERE price IS NOT NULL AND price > 0
      ORDER BY station_code, fuel_code, sale_date DESC`
  );
  const { rows: [{ as_of }] } = await pool.query(`SELECT max(sale_date)::text AS as_of FROM azs.fuel_daily WHERE price IS NOT NULL`);
  const rand = rng(seed);
  const start = new Date(`${as_of}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);

  // уровни: каждый уровень дважды на пару станция–топливо, порядок случайный
  const plan: { station_code: string; fuel_code: string; block_no: number; start: string; end: string;
                base: number; offset: number; target: number }[] = [];
  const perPair = prices.map(p => ({ ...p, levels: shuffle([...LEVELS, ...LEVELS], rand) }));
  for (const p of perPair) {
    // каждый блок — свой уровень из списка; сдвиг по времени, чтобы блоки не совпадали по дням
    for (let b = 0; b < BLOCKS; b++) {
      const offset = p.levels[b];
      const s = new Date(start);
      s.setUTCDate(s.getUTCDate() + b * BLOCK_DAYS);
      const e = new Date(s);
      e.setUTCDate(e.getUTCDate() + BLOCK_DAYS - 1);
      plan.push({
        station_code: p.station_code, fuel_code: p.fuel_code, block_no: b + 1,
        start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10),
        base: p.price, offset, target: Math.round((p.price + offset) * 100) / 100
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM price_test_plan WHERE status = 'draft'`);
    for (const r of plan) {
      await client.query(
        // azs_id — станция приложения по коду аналитики: по нему RLS ограничивает видимость для manager
        `INSERT INTO price_test_plan (station_code, azs_id, fuel_code, block_no, start_date, end_date, base_price, offset_rub, target_price, created_by)
         VALUES ($1,
                 (SELECT a.id FROM public.azs a JOIN azs.station s ON s.station_name = a.name WHERE s.station_code = $1 LIMIT 1),
                 $2, $3, $4, $5, $6, $7, $8, $9)`,
        [r.station_code, r.fuel_code, r.block_no, r.start, r.end, r.base, r.offset, r.target, userId]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { rows: plan.length, pairs: prices.length, blocks: BLOCKS, blockDays: BLOCK_DAYS, levels: LEVELS, startDate: start.toISOString().slice(0, 10) };
}
