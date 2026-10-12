/**
 * «Пульт» (FR-5.1): рейтинг станций, карточки станций, срочные рекомендации.
 * GET /api/dashboard?days=7|14|28|56|91 — окно анализа; менеджер видит только свои станции.
 *
 * Показатели (окно и предыдущее такой же длины):
 *   volume          — продажи всех видов топлива, л
 *   volumeChange    — изменение продаж, %
 *   volumeChangeAdj — то же без «акционных» дней: первые 14 дней после старта акции (акции действуют на всю сеть;
 *                     бессрочные акции идут постоянно, поэтому учитывается запуск, а не сама акция)
 *   promoDays       — акционных дней в окне
 *   pricePos        — позиция цены: наша средняя − медиана конкурентов за 14 дней, ₽/л
 *   carsPerDay      — трафик: легковые машины в день
 *   carsChange      — изменение трафика, %
 *   fillShare       — доля заезда: литров на одну легковую машину (за дни, где есть трафик)
 *   fillShareChange — изменение доли заезда, %
 *   rainEffect      — влияние осадков, % объёма в дождливый день относительно сухого при прочих равных
 *                     (регрессия за год: день недели, месяц, праздник, станция, акции)
 *
 * Изменение объёма раскладывается на трафик и долю заезда: (1 + Δтрафика)·(1 + Δдоли) − 1 ≈ Δобъёма.
 */
import { Express, Request, Response, NextFunction } from 'express';
import { getPool } from '@config/database';
import { actorOf, accessibleStationIds } from '@services/access.service';
import { invert, CLOSED_DAY_SHARE } from '@services/elasticity.service';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

export const DASHBOARD_WINDOWS = [7, 14, 28, 56, 91];
const round = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const pct = (cur: number | null, prev: number | null) => (cur === null || prev === null || prev === 0 ? null : round((cur / prev - 1) * 100));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** МНК: коэффициент и t-статистика для столбца idx */
function olsCoef(X: number[][], y: number[], idx: number): { b: number; t: number | null } | null {
  const k = X[0].length;
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < X.length; i++) for (let a = 0; a < k; a++) {
    Xty[a] += X[i][a] * y[i];
    for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
  }
  const inv = invert(XtX);
  if (!inv) return null;
  const beta = inv.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0));
  let rss = 0;
  for (let i = 0; i < X.length; i++) rss += (y[i] - X[i].reduce((s, v, j) => s + v * beta[j], 0)) ** 2;
  const sigma2 = rss / (X.length - k);
  const se = Math.sqrt(sigma2 * inv[idx][idx]);
  return { b: beta[idx], t: se > 0 ? beta[idx] / se : null };
}

type StationDay = { code: string; d: string; vol: number; cars: number | null; promo: boolean; dow: number; holiday: boolean; month: number; rain: number | null };

/** Дни станций с признаками (продажи, трафик, акция, календарь, осадки) */
async function stationDays(asOf: string, from: number, codes: string[]): Promise<StationDay[]> {
  const { rows } = await getPool().query(
    `SELECT f.station_code AS code, f.sale_date::text AS d, sum(f.sales_volume)::float AS vol,
            max(t.cars)::float AS cars, bool_or(p.d IS NOT NULL) AS promo,
            EXTRACT(ISODOW FROM c.cal_date)::int AS dow, c.is_holiday AS holiday, c.month AS month, max(w.precipitation_mm)::float AS rain
       FROM azs.fuel_daily f
       JOIN azs.calendar c ON c.cal_date = f.sale_date
       LEFT JOIN azs.traffic_daily t ON t.station_code = f.station_code AND t.traffic_date = f.sale_date
       LEFT JOIN azs.weather_daily w ON w.station_code = f.station_code AND w.weather_date = f.sale_date
       LEFT JOIN (SELECT DISTINCT cal.cal_date AS d FROM azs.calendar cal
                    JOIN azs.promotion pr ON cal.cal_date BETWEEN pr.start_date AND pr.start_date + 13
                   WHERE pr.start_date IS NOT NULL) p ON p.d = f.sale_date
      WHERE f.station_code = ANY($2) AND f.sale_date > $1::date - $3::int AND f.sale_date <= $1::date
      GROUP BY f.station_code, f.sale_date, EXTRACT(ISODOW FROM c.cal_date)::int, c.is_holiday, c.month
      ORDER BY 1, 2`,
    [asOf, codes, from]
  );
  return rows.map(r => ({
    code: r.code, d: r.d, vol: r.vol, cars: r.cars, promo: !!r.promo,
    dow: Number(r.dow), holiday: !!r.holiday, month: Number(r.month), rain: r.rain
  }));
}

/** Закрытые дни (объём ниже доли медианного дня станции) не учитываются */
function openDays(days: StationDay[]): StationDay[] {
  const byCode = new Map<string, number[]>();
  for (const r of days) byCode.set(r.code, [...(byCode.get(r.code) ?? []), r.vol]);
  const med = new Map([...byCode.entries()].map(([c, v]) => {
    const s = [...v].sort((a, b) => a - b);
    return [c, s[Math.floor(s.length / 2)] ?? 0];
  }));
  return days.filter(r => r.vol >= CLOSED_DAY_SHARE * (med.get(r.code) ?? 0));
}

/** Влияние осадков: регрессия ln(объёма) за год с контролями; возвращает % или null */
async function rainEffectAdjusted(asOf: string, codes: string[]): Promise<number | null> {
  const days = openDays(await stationDays(asOf, 365, codes)).filter(r => r.rain !== null);
  const rainy = days.filter(r => (r.rain as number) > 0).length;
  if (days.length < 200 || rainy < 30) return null;
  const stations = [...new Set(days.map(r => r.code))].sort();
  const X: number[][] = [], y: number[] = [];
  for (const r of days) {
    const row = [1, (r.rain as number) > 0 ? 1 : 0];
    for (const s of stations.slice(1)) row.push(r.code === s ? 1 : 0);
    for (const dw of [2, 3, 4, 5, 6, 7]) row.push(r.dow === dw ? 1 : 0);
    row.push(r.holiday ? 1 : 0);
    for (let m = 2; m <= 12; m++) row.push(r.month === m ? 1 : 0);
    row.push(r.promo ? 1 : 0);
    X.push(row);
    y.push(Math.log(r.vol));
  }
  // столбцы без вариации (например, праздников нет) убираем
  const width = X[0].length;
  const keep = [0, 1];
  for (let j = 2; j < width; j++) if (X.reduce((s, row) => s + row[j], 0) > 0 && X.reduce((s, row) => s + row[j], 0) < X.length) keep.push(j);
  const Xk = X.map(row => keep.map(j => row[j]));
  const coef = olsCoef(Xk, y, 1);
  if (!coef || coef.t === null || Math.abs(coef.t) < 2) return null;
  return round((Math.exp(coef.b) - 1) * 100);
}

export async function dashboard(days: number, allowed: string[] | null, dateOverride?: string) {
  const pool = getPool();
  const { rows: st } = await pool.query(`SELECT id::text, name, substring(name from '(\\d{3})$') AS code FROM public.azs ORDER BY name`);
  const stations = st.filter(s => s.code && (allowed === null || allowed.includes(s.id)));
  const codes = stations.map(s => s.code as string);
  const lastDay: string | null = (await pool.query(`SELECT max(sale_date)::text AS d FROM azs.fuel_daily WHERE price IS NOT NULL`)).rows[0]?.d ?? null;
  // день анализа не позже последнего дня данных
  const asOf: string | null = lastDay && dateOverride ? [dateOverride, lastDay].sort()[0] : lastDay;
  if (!asOf || !codes.length) return { asOfDate: asOf, window: days, stations: [], urgent: [] };

  // дни станций за два окна; закрытые дни исключаем из всех средних
  const all = openDays(await stationDays(asOf, 2 * days, codes));
  const asOfDt = new Date(`${asOf}T00:00:00Z`).getTime();
  const isCur = (d: string) => (asOfDt - new Date(`${d}T00:00:00Z`).getTime()) / 86400000 < days;

  const [price, rain] = await Promise.all([
    pool.query(
      `WITH ours AS (
         SELECT DISTINCT ON (station_code, fuel_code) station_code, fuel_code, price::float AS p
           FROM azs.fuel_daily WHERE price > 0 AND station_code = ANY($2) AND sale_date <= $1::date
          ORDER BY station_code, fuel_code, sale_date DESC),
       comp AS (
         SELECT c.station_code, cp.fuel_code, percentile_cont(0.5) WITHIN GROUP (ORDER BY cp.price)::float AS med
           FROM azs.competitor_price cp JOIN azs.competitor c USING (competitor_id)
          WHERE cp.is_offered AND cp.price > 0
            AND cp.observed_at::date > $1::date - 14 AND cp.observed_at::date <= $1::date
          GROUP BY 1, 2)
       SELECT o.station_code, o.fuel_code, o.p::float AS price, c.med::float AS med, (o.p - c.med)::float AS diff
         FROM ours o LEFT JOIN comp c USING (station_code, fuel_code)`, [asOf, codes]),
    rainEffectAdjusted(asOf, codes)
  ]);
  // позиция цены — как и раньше, по основным видам топлива (AI92, AI95, DT)
  const MAIN = ['AI92', 'AI95', 'DT'];
  const priceRows: any[] = price.rows;
  const posRows = priceRows.filter(r => MAIN.includes(r.fuel_code) && r.diff !== null);
  const posBy = new Map<string, number>();
  for (const code of new Set(posRows.map(r => r.station_code as string))) {
    const xs = posRows.filter(r => r.station_code === code).map(r => Number(r.diff));
    posBy.set(code, xs.reduce((a, b) => a + b, 0) / xs.length);
  }
  // цены по каждому виду топлива станции: наша цена и отклонение от медианы конкурентов
  const ORDER = ['AI92', 'AI95', 'AI100_bio', 'DT', 'DT_bio'];
  const fuelsBy = new Map<string, { fuel: string; price: number; toMarket: number | null }[]>();
  for (const r of priceRows) {
    const list = fuelsBy.get(r.station_code as string) ?? [];
    list.push({ fuel: r.fuel_code as string, price: Number(r.price), toMarket: r.diff === null ? null : round(Number(r.diff), 2) });
    fuelsBy.set(r.station_code as string, list);
  }
  const rankOf = (fuel: string) => (ORDER.includes(fuel) ? ORDER.indexOf(fuel) : ORDER.length);
  for (const list of fuelsBy.values()) {
    list.sort((a, b) => rankOf(a.fuel) - rankOf(b.fuel) || a.fuel.localeCompare(b.fuel));
  }

  const rows = stations.map(s => {
    const mine = all.filter(r => r.code === s.code);
    const cur = mine.filter(r => isCur(r.d));
    const prev = mine.filter(r => !isCur(r.d));
    const sumVol = (xs: StationDay[]) => xs.reduce((a, r) => a + r.vol, 0);
    const volCur = sumVol(cur), volPrev = sumVol(prev);
    // без дней с акцией (акции действуют на всю сеть): средний дневной объём в дни без акций
    const nonPromoCur = mean(cur.filter(r => !r.promo).map(r => r.vol));
    const nonPromoPrev = mean(prev.filter(r => !r.promo).map(r => r.vol));
    // трафик и доля заезда по дням, где есть данные о трафике
    const withCarsCur = cur.filter(r => r.cars !== null), withCarsPrev = prev.filter(r => r.cars !== null);
    const carsCur = mean(withCarsCur.map(r => r.cars as number)), carsPrev = mean(withCarsPrev.map(r => r.cars as number));
    const fillCur = withCarsCur.length ? sumVol(withCarsCur) / withCarsCur.reduce((a, r) => a + (r.cars as number), 0) : null;
    const fillPrev = withCarsPrev.length ? sumVol(withCarsPrev) / withCarsPrev.reduce((a, r) => a + (r.cars as number), 0) : null;
    return {
      id: s.id,
      station: s.name,
      volume: round(volCur, 0),
      volumeChange: pct(volCur, volPrev),
      volumeChangeAdj: pct(nonPromoCur, nonPromoPrev),
      promoDays: cur.filter(r => r.promo).length,
      pricePos: round(posBy.get(s.code as string), 2),
      fuels: fuelsBy.get(s.code as string) ?? [],
      carsPerDay: round(carsCur, 0),
      carsChange: pct(carsCur, carsPrev),
      fillShare: round(fillCur, 2),
      fillShareChange: pct(fillCur, fillPrev),
      rainEffect: rain
    };
  }).sort((a, b) => (b.volumeChangeAdj ?? -Infinity) - (a.volumeChangeAdj ?? -Infinity));

  const { rows: urgent } = await pool.query(
    `SELECT r.id, r.rule_id, r.priority, r.title, r.action, r.effect, a.name AS station
       FROM recommendations r LEFT JOIN public.azs a ON a.id = r.azs_id
      WHERE r.status = 'active' AND ($1::uuid[] IS NULL OR r.azs_id IS NULL OR r.azs_id = ANY($1::uuid[]))
      ORDER BY CASE r.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, r.created_at DESC
      LIMIT 5`, [allowed]
  );

  return {
    asOfDate: asOf,
    window: days,
    stations: rows,
    urgent: urgent.map(u => ({ id: u.id, rule: u.rule_id, priority: u.priority, title: u.title, action: u.action, effect: u.effect, station: u.station ?? 'Вся сеть' }))
  };
}

export function registerDashboardRoutes(
  app: Express,
  authenticateToken: Handler,
  asyncHandler: (fn: (req: Request, res: Response) => Promise<unknown>) => Handler
) {
  app.get('/api/dashboard', authenticateToken, asyncHandler(async (req, res) => {
    const w = Number(req.query.days);
    const days = DASHBOARD_WINDOWS.includes(w) ? w : 28;
    const allowed = await accessibleStationIds(await actorOf(req));
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : undefined;
    res.json({ success: true, data: await dashboard(days, allowed, date) });
  }));
}
