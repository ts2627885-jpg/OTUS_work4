/**
 * Аналитические вкладки FR-5.2–5.8. Все расчёты — по схеме azs (ежедневные данные).
 * Каждая вкладка возвращает набор таблиц (sections) с пояснением, если данных мало или метод упрощённый.
 *
 * Важно: в данных нет себестоимости, скидок и объёма рынка, поэтому маржа, ROI акций и доля захвата
 * не считаются — это указано в пояснениях вкладок.
 */
import { getPool } from '@config/database';
import { computeRules } from '@services/rules.service';
import { invert, CLOSED_DAY_SHARE } from '@services/elasticity.service';
import { compElasticityRows } from '@services/rules-extra.service';

export interface Column {
  key: string;
  label: string;
}
export interface ChartSpec {
  labels: string[]; // ось X (даты)
  datasets: { label: string; data: (number | null)[] }[];
  yLabel: string;
}
export interface Section {
  title: string;
  note?: string;
  columns: Column[];
  rows: Record<string, any>[];
  chart?: ChartSpec;
  fuel?: string;
}

/** Собирает ряды по датам: у каждого ряда своё значение на каждую дату (null — нет наблюдения) */
function toChart(
  points: { series: string; date: string; value: number }[],
  yLabel: string
): ChartSpec {
  const labels = [...new Set(points.map((p) => p.date))].sort();
  const idx = new Map(labels.map((d, i) => [d, i]));
  const byName = new Map<string, (number | null)[]>();
  for (const p of points) {
    const arr = byName.get(p.series) ?? new Array(labels.length).fill(null);
    arr[idx.get(p.date) as number] = round(p.value, 2);
    byName.set(p.series, arr);
  }
  return {
    labels,
    datasets: [...byName.entries()].map(([label, data]) => ({ label, data })),
    yLabel,
  };
}
export interface TabResult {
  tab: string;
  asOf: string | null;
  sections: Section[];
}

export const TABS = [
  'prices',
  'competitors',
  'traffic',
  'factors',
  'volume',
  'shop',
  'promotions',
] as const;
export type Tab = (typeof TABS)[number];

const MIN_SAMPLE = 30;
const FUELS_CHART = ['AI92', 'AI95', 'DT']; // виды топлива на графиках конкурентов
const round = (v: unknown, d = 2) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? null
    : Math.round(Number(v) * 10 ** d) / 10 ** d;
const pct = (cur: number | null, prev: number | null) =>
  cur === null || prev === null || prev === 0 ? null : round((cur / prev - 1) * 100, 1);

/** Коды станций в области доступа: null — все станции */
export async function scopeCodes(
  allowedIds: string[] | null,
  azsId?: string
): Promise<{ codes: string[] | null; names: Map<string, string> }> {
  const { rows } = await getPool().query(
    `SELECT id::text, name, substring(name from '(\\d{3})$') AS code FROM public.azs`
  );
  const names = new Map<string, string>(rows.map((r) => [r.code, r.name]));
  let ids = rows.filter((r) => r.code);
  if (allowedIds !== null) ids = ids.filter((r) => allowedIds.includes(r.id));
  if (azsId) ids = ids.filter((r) => r.id === azsId);
  const codes = allowedIds === null && !azsId ? null : ids.map((r) => r.code as string);
  return { codes, names };
}

async function asOfDate(): Promise<string | null> {
  const { rows } = await getPool().query(
    `SELECT max(sale_date)::text AS d FROM azs.fuel_daily WHERE price IS NOT NULL`
  );
  return rows[0]?.d ?? null;
}

// ---------- 1. Ценовая политика (FR-5.2) ----------
async function prices(
  codes: string[] | null,
  names: Map<string, string>,
  elasticityDays?: number
): Promise<Section[]> {
  const { rows } = await getPool().query(
    `WITH lat AS (
       SELECT DISTINCT ON (station_code, fuel_code) station_code, fuel_code, price::float AS price, sale_date
         FROM azs.fuel_daily WHERE price IS NOT NULL AND ($1::text[] IS NULL OR station_code = ANY($1))
        ORDER BY station_code, fuel_code, sale_date DESC),
     prev AS (
       SELECT DISTINCT ON (f.station_code, f.fuel_code) f.station_code, f.fuel_code, f.price::float AS price
         FROM azs.fuel_daily f JOIN lat l ON l.station_code = f.station_code AND l.fuel_code = f.fuel_code
        WHERE f.price IS NOT NULL AND f.sale_date < l.sale_date
        ORDER BY f.station_code, f.fuel_code, f.sale_date DESC),
     ma AS (
       SELECT f.station_code, f.fuel_code, avg(f.sales_volume)::float AS ma7
         FROM azs.fuel_daily f JOIN lat l ON l.station_code = f.station_code AND l.fuel_code = f.fuel_code
        WHERE f.sale_date > l.sale_date - 7 AND f.sale_date <= l.sale_date
        GROUP BY f.station_code, f.fuel_code)
     SELECT lat.station_code, lat.fuel_code, lat.price, prev.price AS prev_price, ma.ma7, lat.sale_date::text AS d
       FROM lat LEFT JOIN prev USING (station_code, fuel_code) LEFT JOIN ma USING (station_code, fuel_code)
      ORDER BY lat.station_code, lat.fuel_code`,
    [codes]
  );
  // эластичность — из расчёта правил (показывается только при надёжной модели)
  const calc = await computeRules({ elasticityDays });
  const models = calc.models;
  const out = rows.map((r) => {
    const m = models[`${r.station_code}-${r.fuel_code}`];
    const e = m?.elasticity ?? null;
    const se = m?.se ?? null;
    const perRub = (v: number | null) =>
      v === null || r.price === null ? null : round((v / r.price) * 100, 2);
    // 95%-интервал изменения объёма при +1 ₽ (e ± 1.96·se)
    const band =
      e === null || se === null || r.price === null
        ? null
        : `${perRub(e - 1.96 * se)} … ${perRub(e + 1.96 * se)}`;
    return {
      station: names.get(r.station_code) ?? r.station_code,
      fuel: r.fuel_code,
      price: round(r.price),
      prevPrice: round(r.prev_price),
      change: r.prev_price === null ? null : round(r.price - r.prev_price),
      volumeMa7: round(r.ma7, 0),
      elasticity: round(e, 2),
      source: m?.source ?? '—',
      why:
        e === null
          ? (m?.reason ?? 'вид топлива не входит в расчёт (правила считают AI92, AI95, DT)')
          : '—',
      n: m?.n ?? null,
      se: se === null ? null : round(se, 3),
      r2: m?.r2 ?? null,
      plusOne: perRub(e),
      plusOneBand: band,
      minusOne: e === null || r.price === null ? null : round((-e / r.price) * 100, 2),
    };
  });
  // сводка в примечании к таблице: какие пары надёжны, какие нет
  const reliable = out.filter((r) => r.elasticity !== null);
  const reliableList = reliable.map((r) => `${r.station} · ${r.fuel} (${r.elasticity})`).join(', ');
  const summary =
    `Итог: значимая оценка (по станции или по сети) у ${reliable.length} из ${out.length} пар${reliable.length ? ': ' + reliableList : ''}. ` +
    `Остальные пары — в колонке «Почему нет оценки»: прогноз для них не строится, нужен тест цены.`;
  return [
    {
      title: 'Текущие цены и чувствительность объёма',
      note: `${summary} Окно эластичности ${elasticityDays ?? 365} дн. «Эффект при +1 ₽» = эластичность / цена × 100, интервал — 95%. Эластичность — по станции, если она значима (|t| ≥ 2), иначе по сети. Нерабочие дни исключены.`,
      columns: [
        { key: 'station', label: 'АЗС' },
        { key: 'fuel', label: 'Топливо' },
        { key: 'price', label: 'Цена, ₽' },
        { key: 'prevPrice', label: 'Пред. цена' },
        { key: 'change', label: 'Изменение' },
        { key: 'volumeMa7', label: 'Объём MA7, л/день' },
        { key: 'elasticity', label: 'Эластичность' },
        { key: 'source', label: 'Оценка по' },
        { key: 'why', label: 'Почему нет оценки' },
        { key: 'n', label: 'Наблюдений' },
        { key: 'r2', label: 'R²' },
        { key: 'plusOne', label: 'Изменение объёма при +1 ₽, %' },
        { key: 'plusOneBand', label: 'Интервал 95%, %' },
        { key: 'minusOne', label: 'Изменение объёма при −1 ₽, %' },
      ],
      rows: out,
    },
  ];
}

// ---------- 2. Конкуренты (FR-5.3) ----------
async function competitors(codes: string[] | null, names: Map<string, string>): Promise<Section[]> {
  const { rows } = await getPool().query(
    `WITH base AS (
       SELECT c.station_code, c.brand, cp.fuel_code, cp.price::float AS price, cp.observed_at
         FROM azs.competitor_price cp JOIN azs.competitor c USING (competitor_id)
        WHERE cp.is_offered AND cp.price > 0
          AND cp.observed_at > (SELECT max(observed_at) FROM azs.competitor_price) - interval '120 days'
          AND ($1::text[] IS NULL OR c.station_code = ANY($1))),
     latest AS (
       SELECT DISTINCT ON (station_code, brand, fuel_code) station_code, brand, fuel_code, price, observed_at
         FROM base ORDER BY station_code, brand, fuel_code, observed_at DESC),
     before AS (
       SELECT DISTINCT ON (b.station_code, b.brand, b.fuel_code) b.station_code, b.brand, b.fuel_code, b.price
         FROM base b JOIN latest l USING (station_code, brand, fuel_code)
        WHERE b.observed_at <= l.observed_at - interval '7 days'
        ORDER BY b.station_code, b.brand, b.fuel_code, b.observed_at DESC),
     stats AS (
       SELECT station_code, brand, fuel_code, min(price) AS mn, max(price) AS mx, avg(price) AS av
         FROM base GROUP BY station_code, brand, fuel_code)
     SELECT l.station_code, l.brand, l.fuel_code, l.price, l.observed_at::date::text AS d,
            l.price - b.price AS change7, s.mn, s.mx, s.av
       FROM latest l LEFT JOIN before b USING (station_code, brand, fuel_code)
       JOIN stats s USING (station_code, brand, fuel_code)
      ORDER BY l.station_code, l.fuel_code, l.brand`,
    [codes]
  );
  const ours = await getPool().query(
    `SELECT DISTINCT ON (station_code, fuel_code) station_code, fuel_code, price::float AS price
       FROM azs.fuel_daily WHERE price IS NOT NULL ORDER BY station_code, fuel_code, sale_date DESC`
  );
  const ourPrice = new Map<string, number>(
    ours.rows.map((r) => [`${r.station_code}|${r.fuel_code}`, r.price])
  );
  const series = await getPool().query(
    `SELECT c.station_code, c.brand, cp.fuel_code, cp.observed_at::date::text AS d, avg(cp.price)::float AS price
       FROM azs.competitor_price cp JOIN azs.competitor c USING (competitor_id)
      WHERE cp.is_offered AND cp.price > 0 AND cp.fuel_code = ANY($2)
        AND cp.observed_at > (SELECT max(observed_at) FROM azs.competitor_price) - interval '120 days'
        AND ($1::text[] IS NULL OR c.station_code = ANY($1))
      GROUP BY 1, 2, 3, 4 ORDER BY 4`,
    [codes, FUELS_CHART]
  );
  // график на каждую пару станция–топливо: наша цена и конкуренты этого топлива
  const seriesRows: any[] = series.rows;
  const ourSeries = await getPool().query(
    `SELECT station_code, fuel_code, sale_date::text AS d, price::float AS price FROM azs.fuel_daily
      WHERE price > 0 AND fuel_code = ANY($2)
        AND sale_date > (SELECT max(observed_at)::date FROM azs.competitor_price) - 120
        AND ($1::text[] IS NULL OR station_code = ANY($1))
      ORDER BY 3`,
    [codes, FUELS_CHART]
  );
  const ourRows: any[] = ourSeries.rows;
  const pairs: string[] = [
    ...new Set<string>(seriesRows.map((r) => `${r.station_code}|${r.fuel_code}`)),
  ].sort();
  const chartSections: Section[] = pairs.map((key) => {
    const [code, fuel] = key.split('|');
    const ours = ourRows.filter((r) => r.station_code === code && r.fuel_code === fuel);
    const comp = seriesRows.filter((r) => r.station_code === code && r.fuel_code === fuel);
    const points = [
      ...ours.map((r) => ({ series: 'Наша цена', date: r.d, value: r.price })),
      ...comp.map((r) => ({ series: r.brand, date: r.d, value: r.price })),
    ];
    return {
      title: `${names.get(code) ?? code} · ${fuel}: наша цена и конкуренты`,
      fuel,
      chart: toChart(points, '₽/л'),
      columns: [],
      rows: [],
    };
  });
  return [
    {
      title: 'Цены конкурентов (последнее наблюдение и 120 дней)',
      note: 'Разница = наша цена − цена конкурента. Изменение за 7 дней — к ближайшему наблюдению неделей раньше. График — отдельно по каждой АЗС ниже таблицы.',
      columns: [
        { key: 'station', label: 'АЗС' },
        { key: 'brand', label: 'Конкурент' },
        { key: 'fuel', label: 'Топливо' },
        { key: 'price', label: 'Цена, ₽' },
        { key: 'observed', label: 'Наблюдено' },
        { key: 'change7', label: 'Изм. за 7 дн.' },
        { key: 'min120', label: 'Мин 120 дн.' },
        { key: 'max120', label: 'Макс 120 дн.' },
        { key: 'avg120', label: 'Среднее 120 дн.' },
        { key: 'diff', label: 'Наша − конкурент' },
      ],
      rows: rows.map((r) => {
        const our = ourPrice.get(`${r.station_code}|${r.fuel_code}`);
        return {
          station: names.get(r.station_code) ?? r.station_code,
          brand: r.brand,
          fuel: r.fuel_code,
          price: round(r.price),
          observed: r.d,
          change7: round(r.change7),
          min120: round(r.mn),
          max120: round(r.mx),
          avg120: round(r.av),
          diff: our === undefined ? null : round(our - r.price),
        };
      }),
    },
    ...chartSections,
  ];
}

// ---------- 3. Трафик (FR-5.4) ----------
async function traffic(codes: string[] | null, names: Map<string, string>): Promise<Section[]> {
  const t = await getPool().query(
    `SELECT station_code, traffic_date::text AS d, cars::float AS cars, transporters::float AS tr, trucks::float AS trucks
       FROM azs.traffic_daily
      WHERE traffic_date > (SELECT max(traffic_date) FROM azs.traffic_daily) - 28 AND ($1::text[] IS NULL OR station_code = ANY($1))`,
    [codes]
  );
  const f = await getPool().query(
    `SELECT station_code, sale_date::text AS d, sum(sales_volume)::float AS liters
       FROM azs.fuel_daily
      WHERE sale_date > (SELECT max(traffic_date) FROM azs.traffic_daily) - 28 AND ($1::text[] IS NULL OR station_code = ANY($1))
      GROUP BY station_code, sale_date`,
    [codes]
  );
  const fuelBy = new Map<string, number>(f.rows.map((r) => [`${r.station_code}|${r.d}`, r.liters]));
  const agg = new Map<
    string,
    { cars: number[]; tr: number[]; trucks: number[]; liters: number; carsOnDays: number }
  >();
  for (const r of t.rows) {
    const a = agg.get(r.station_code) ?? { cars: [], tr: [], trucks: [], liters: 0, carsOnDays: 0 };
    a.cars.push(r.cars ?? 0);
    a.tr.push(r.tr ?? 0);
    a.trucks.push(r.trucks ?? 0);
    const liters = fuelBy.get(`${r.station_code}|${r.d}`);
    if (liters !== undefined) {
      a.liters += liters;
      a.carsOnDays += r.cars ?? 0;
    }
    agg.set(r.station_code, a);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : null);
  // медиана легковых по станциям: станция заметно ниже медианы помечается (см. TRAFFIC-003)
  const medianCars = (() => {
    const xs = [...agg.values()].map((a) => avg(a.cars) ?? 0).sort((x, y) => x - y);
    if (!xs.length) return null;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  })();
  const rows = [...agg.entries()].map(([code, a]) => {
    const cars = avg(a.cars),
      trucks = avg(a.trucks),
      tr = avg(a.tr);
    const total = (cars ?? 0) + (trucks ?? 0) + (tr ?? 0);
    const lowCars = medianCars !== null && (cars ?? 0) < 0.2 * medianCars;
    const shortHistory = a.cars.length < 25;
    return {
      station: names.get(code) ?? code,
      cars: round(cars, 0),
      transporters: round(tr, 0),
      trucks: round(trucks, 0),
      truckShare: total ? round((((trucks ?? 0) + (tr ?? 0)) / total) * 100, 1) : null,
      litersPerCar: a.carsOnDays ? round(a.liters / a.carsOnDays, 2) : null,
      days: a.cars.length,
      flag: lowCars
        ? 'трафик ниже 20% медианы: проверить датчик или выгрузку'
        : shortHistory
          ? 'мало дней трафика'
          : '—',
    };
  });
  const carsPoints = t.rows.map((r) => ({
    series: names.get(r.station_code) ?? r.station_code,
    date: r.d,
    value: r.cars ?? 0,
  }));
  return [
    {
      title: 'Структура потока и доля заезда за 28 дней',
      chart: toChart(carsPoints, 'легковые, ТС/день'),
      note: 'Доля заезда (л/ТС) = литры топлива / легковые машины за те же дни. Доля рынка не считается: нет данных по рынку.',
      columns: [
        { key: 'station', label: 'АЗС' },
        { key: 'cars', label: 'Легковые, сред./день' },
        { key: 'transporters', label: 'Транспортёры' },
        { key: 'trucks', label: 'Грузовые' },
        { key: 'truckShare', label: 'Доля грузовых, %' },
        { key: 'litersPerCar', label: 'Л на ТС' },
        { key: 'days', label: 'Дней' },
        { key: 'flag', label: 'Пометка' },
      ],
      rows,
    },
  ];
}

// ---------- 4. Факторы спроса (FR-5.5) ----------
async function factors(codes: string[] | null): Promise<Section[]> {
  const pool = getPool();
  const { rows: stationDays } = await pool.query(
    `SELECT f.station_code, f.sale_date::text AS d, sum(f.sales_volume)::float AS liters,
            EXTRACT(ISODOW FROM c.cal_date)::int AS day_of_week, c.is_holiday, c.month, w.weather_type, w.temperature_c::float AS temp
       FROM azs.fuel_daily f
       JOIN azs.calendar c ON c.cal_date = f.sale_date
       LEFT JOIN azs.weather_daily w ON w.station_code = f.station_code AND w.weather_date = f.sale_date
      WHERE f.sale_date > (SELECT max(sale_date) FROM azs.fuel_daily) - 365
        AND ($1::text[] IS NULL OR f.station_code = ANY($1))
      GROUP BY f.station_code, f.sale_date, EXTRACT(ISODOW FROM c.cal_date)::int, c.is_holiday, c.month, w.weather_type, w.temperature_c`,
    [codes]
  );
  const group = (key: (r: any) => string | null, label: string) => {
    const m = new Map<string, number[]>();
    for (const r of stationDays) {
      const k = key(r);
      if (k === null) continue;
      const arr = m.get(k) ?? [];
      arr.push(r.liters);
      m.set(k, arr);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([k, xs]) => {
        const n = xs.length;
        const mean = xs.reduce((a, b) => a + b, 0) / n;
        // 95% доверительный интервал среднего: mean ± 1.96 · sd / √n (нормальное приближение)
        const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
        const half = n > 1 ? (1.96 * sd) / Math.sqrt(n) : 0;
        return {
          factor: label,
          group: k,
          avgLiters: round(mean, 0),
          n,
          ci95: n > 1 ? `${round(mean - half, 0)} … ${round(mean + half, 0)}` : '—',
          reliable: n >= MIN_SAMPLE ? 'да' : `мало данных (<${MIN_SAMPLE})`,
        };
      });
  };
  const weekdays = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const tempBucket = (t: number | null) =>
    t === null
      ? null
      : t < 0
        ? 'ниже 0 °C'
        : t < 10
          ? '0…10 °C'
          : t < 20
            ? '10…20 °C'
            : '20 °C и выше';
  const sections: Section[] = [
    {
      title: 'Влияние фактора на объём (литры на станцию-день, за 365 дней)',
      note: `Средний объём на станцию-день по группам с 95% доверительным интервалом (нормальное приближение). Группы с менее чем ${MIN_SAMPLE} наблюдениями помечены как ненадёжные.`,
      columns: [
        { key: 'factor', label: 'Фактор' },
        { key: 'group', label: 'Группа' },
        { key: 'avgLiters', label: 'Сред. л/день' },
        { key: 'ci95', label: 'Доверительный интервал 95%, л' },
        { key: 'n', label: 'Наблюдений' },
        { key: 'reliable', label: 'Надёжно' },
      ],
      rows: [
        ...group(
          (r) => (r.day_of_week ? `${r.day_of_week}-${weekdays[(r.day_of_week - 1) % 7]}` : null),
          'День недели'
        ),
        ...group((r) => (r.is_holiday ? 'праздник' : 'будни/выходные'), 'Праздники'),
        ...group((r) => (r.month ? String(r.month).padStart(2, '0') : null), 'Месяц (сезонность)'),
        ...group((r) => r.weather_type ?? null, 'Погода'),
        ...group((r) => tempBucket(r.temp), 'Температура'),
      ],
    },
  ];
  return sections;
}

// ---------- 5. Влияние на объём (FR-5.6) ----------
async function volume(codes: string[] | null, names: Map<string, string>): Promise<Section[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH d AS (SELECT max(sale_date) AS m FROM azs.fuel_daily),
     v AS (
       SELECT f.station_code,
              sum(CASE WHEN f.sale_date > d.m - 30 THEN f.sales_volume END)::float AS cur,
              sum(CASE WHEN f.sale_date <= d.m - 30 AND f.sale_date > d.m - 60 THEN f.sales_volume END)::float AS prev
         FROM azs.fuel_daily f, d
        WHERE f.sale_date > d.m - 60 AND ($1::text[] IS NULL OR f.station_code = ANY($1))
        GROUP BY f.station_code),
     t AS (
       SELECT t.station_code,
              avg(CASE WHEN t.traffic_date > d.m - 30 THEN t.cars END)::float AS cur,
              avg(CASE WHEN t.traffic_date <= d.m - 30 AND t.traffic_date > d.m - 60 THEN t.cars END)::float AS prev
         FROM azs.traffic_daily t, (SELECT max(traffic_date) AS m FROM azs.traffic_daily) d
        WHERE t.traffic_date > d.m - 60 AND ($1::text[] IS NULL OR t.station_code = ANY($1))
        GROUP BY t.station_code),
     net AS (SELECT sum(cur) AS total FROM v)
     SELECT v.station_code, v.cur, v.prev, t.cur AS tcur, t.prev AS tprev, v.cur / NULLIF(net.total, 0) AS share
       FROM v LEFT JOIN t USING (station_code), net`,
    [codes]
  );
  return [
    {
      title: 'Объём и трафик: последние 30 дней к предыдущим 30',
      note: 'Цена и конкуренты влияют на объём через вкладку «Ценовая политика» и «Конкуренты». Сетевое сравнение — доля станции в объёме сети. Рекомендации по росту формируются правилами (вкладка «Рекомендации»).',
      columns: [
        { key: 'station', label: 'АЗС' },
        { key: 'litersCur', label: 'Литры, 30 дн.' },
        { key: 'litersChange', label: 'Изм. объёма, %' },
        { key: 'trafficChange', label: 'Изм. трафика, %' },
        { key: 'share', label: 'Доля в объёме сети, %' },
      ],
      rows: rows.map((r) => ({
        station: names.get(r.station_code) ?? r.station_code,
        litersCur: round(r.cur, 0),
        litersChange: pct(r.cur, r.prev),
        trafficChange: pct(r.tcur, r.tprev),
        share: r.share === null ? null : round(r.share * 100, 1),
      })),
    },
  ];
}

// ---------- 6. Сопутствующие товары (FR-5.7) ----------
async function shop(codes: string[] | null, names: Map<string, string>): Promise<Section[]> {
  const pool = getPool();
  const [byGroup, byStation, monthly] = await Promise.all([
    pool.query(
      `SELECT product_code, sum(revenue_rub)::float AS revenue
         FROM azs.shop_sales_daily
        WHERE sale_date > (SELECT max(sale_date) FROM azs.shop_sales_daily) - 365 AND ($1::text[] IS NULL OR station_code = ANY($1))
        GROUP BY product_code ORDER BY revenue DESC`,
      [codes]
    ),
    pool.query(
      `WITH d AS (SELECT max(sale_date) m FROM azs.fuel_daily)
       SELECT s.station_code,
              (SELECT sum(revenue_rub)::float FROM azs.shop_sales_daily x, d
                WHERE x.station_code = s.station_code AND x.sale_date > d.m - 30) AS rev30,
              (SELECT sum(sales_volume)::float FROM azs.fuel_daily x, d
                WHERE x.station_code = s.station_code AND x.sale_date > d.m - 30) AS liters30
         FROM (SELECT DISTINCT station_code FROM azs.shop_sales_daily WHERE ($1::text[] IS NULL OR station_code = ANY($1))) s`,
      [codes]
    ),
    pool.query(
      `SELECT to_char(date_trunc('month', sale_date), 'YYYY-MM') AS month, sum(revenue_rub)::float AS revenue
         FROM azs.shop_sales_daily
        WHERE sale_date > (SELECT max(sale_date) FROM azs.shop_sales_daily) - 365 AND ($1::text[] IS NULL OR station_code = ANY($1))
        GROUP BY 1 ORDER BY 1`,
      [codes]
    ),
  ]);
  const total = byGroup.rows.reduce((a, r) => a + r.revenue, 0);
  return [
    {
      title: 'Структура выручки магазина по категориям (12 месяцев)',
      note: 'Маржа не рассчитывается: в данных нет себестоимости товаров. Категории берутся из выгрузки продаж сопутствующих товаров.',
      columns: [
        { key: 'category', label: 'Категория' },
        { key: 'revenue', label: 'Выручка, ₽' },
        { key: 'share', label: 'Доля, %' },
      ],
      rows: byGroup.rows.map((r) => ({
        category: r.product_code,
        revenue: round(r.revenue, 0),
        share: total ? round((r.revenue / total) * 100, 1) : null,
      })),
    },
    {
      title: 'Выручка магазина на 1000 л топлива (последние 30 дней)',
      note: 'Показатель «₽ на 1000 л» — выручка магазина к литрам топлива. Отклонение от медианы сети — в последнем столбце.',
      columns: [
        { key: 'station', label: 'АЗС' },
        { key: 'rev30', label: 'Выручка магазина, 30 дн., ₽' },
        { key: 'per1000', label: '₽ на 1000 л' },
        { key: 'vsMedian', label: 'Отклонение от медианы, %' },
      ],
      rows: (() => {
        const per = byStation.rows.map((r) => ({
          code: r.station_code,
          rev: r.rev30,
          per: r.liters30 ? (r.rev30 / r.liters30) * 1000 : null,
        }));
        const vals = per
          .map((p) => p.per)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b);
        const med = vals.length ? vals[Math.floor(vals.length / 2)] : null;
        return per.map((p) => ({
          station: names.get(p.code) ?? p.code,
          rev30: round(p.rev, 0),
          per1000: round(p.per, 0),
          vsMedian: p.per !== null && med ? round((p.per / med - 1) * 100, 1) : null,
        }));
      })(),
    },
    {
      title: 'Динамика выручки магазина по месяцам',
      columns: [
        { key: 'month', label: 'Месяц' },
        { key: 'revenue', label: 'Выручка, ₽' },
      ],
      rows: monthly.rows.map((r) => ({ month: r.month, revenue: round(r.revenue, 0) })),
    },
  ];
}

// ---------- 7. Акции (FR-5.8) ----------
/**
 * Поправка на состав недели и праздники: регрессия ln(объёма сети) на день недели и праздник.
 * Возвращает множитель для каждого дня, который убирает эти эффекты (относительно понедельника без праздника).
 * Месяц (сезон) не поправляется: в данных один год, и сезон неотделим от акций декабря–января.
 */
async function calendarAdjustment(): Promise<Map<string, number>> {
  const { rows } = await getPool().query(
    `SELECT f.sale_date::text AS d, sum(f.sales_volume)::float AS liters, EXTRACT(ISODOW FROM c.cal_date)::int AS dow, c.is_holiday AS hol
       FROM azs.fuel_daily f JOIN azs.calendar c ON c.cal_date = f.sale_date
      GROUP BY f.sale_date, EXTRACT(ISODOW FROM c.cal_date)::int, c.is_holiday HAVING sum(f.sales_volume) > 0`
  );
  const X = rows.map((r) => {
    const row = [1];
    for (const dw of [2, 3, 4, 5, 6, 7]) row.push(Number(r.dow) === dw ? 1 : 0);
    row.push(r.hol ? 1 : 0);
    return row;
  });
  const y = rows.map((r) => Math.log(r.liters));
  const k = X[0].length;
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < X.length; i++)
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  const inv = invert(XtX);
  const out = new Map<string, number>();
  if (!inv) return out;
  const beta = inv.map((row) => row.reduce((acc, v, j) => acc + v * Xty[j], 0));
  // множитель: exp(-(эффект дня недели + эффект праздника)) — приводит день к базовому
  rows.forEach((r, i) => {
    const eff = X[i].reduce((acc, v, j) => acc + v * (j === 0 ? 0 : beta[j]), 0);
    out.set(r.d, Math.exp(-eff));
  });
  return out;
}

async function promotions(windowDays = 14): Promise<Section[]> {
  // окно до и после старта одинаковой длины N: эффект = среднее после / среднее до − 1
  const N = windowDays;
  const adj = await calendarAdjustment();
  const { rows: daily } = await getPool().query(
    `SELECT sale_date::text AS d, sum(sales_volume)::float AS liters FROM azs.fuel_daily GROUP BY sale_date ORDER BY 1`
  );
  // дневной объём, очищенный от состава недели и праздников
  const cleaned = daily.map((r) => ({ d: r.d, v: r.liters * (adj.get(r.d) ?? 1) }));
  const meanIn = (from: string, to: string) => {
    const xs = cleaned.filter((r) => r.d >= from && r.d <= to).map((r) => r.v);
    return { avg: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, n: xs.length };
  };
  const shift = (d: string, days: number) => {
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + days);
    return t.toISOString().slice(0, 10);
  };
  const asOf = daily[daily.length - 1]?.d ?? '';
  const { rows: promos } = await getPool().query(
    `SELECT p.name, p.category, p.coverage, p.validity, p.start_date::text AS start FROM azs.promotion p
      WHERE p.start_date IS NOT NULL ORDER BY p.start_date DESC, p.name`
  );
  // сезонная поправка: та же календарная пара окон годом раньше (diff-in-diff).
  // Считается, когда в данных есть прошлый год; иначе поле остаётся пустым с причиной.
  const yearAgo = (d: string) => shift(d, -365);
  const minDate = cleaned.length ? cleaned[0].d : '';
  const rows = promos.map((p) => {
    const afterEnd = [shift(p.start, N - 1), asOf].sort()[0];
    const after = meanIn(p.start, afterEnd);
    const before = meanIn(shift(p.start, -N), shift(p.start, -1));
    const enough = before.n >= Math.min(7, N) && after.n >= Math.min(7, N);
    const effect = enough ? pct(after.avg, before.avg) : null;
    // прошлый год: окна той же длины на год раньше
    const yBefore = meanIn(yearAgo(shift(p.start, -N)), yearAgo(shift(p.start, -1)));
    const yAfter = meanIn(yearAgo(p.start), yearAgo(afterEnd));
    const hasYear =
      yBefore.n >= Math.min(7, N) && yAfter.n >= Math.min(7, N) && yearAgo(p.start) >= minDate;
    const seasonal =
      hasYear && enough && yBefore.avg && yAfter.avg && before.avg && after.avg
        ? round((after.avg / before.avg / (yAfter.avg / yBefore.avg)) * 100 - 100)
        : null;
    return {
      name: p.name,
      category: p.category,
      coverage: p.coverage,
      validity: p.validity ?? '—',
      start: p.start,
      before: round(before.avg, 0),
      after: round(after.avg, 0),
      effect,
      seasonal,
      seasonalNote: hasYear ? 'оценено' : `нет данных за прошлый год (данные с ${minDate})`,
    };
  });
  return [
    {
      title: `Акции: объём сети до и после старта (окно ${N} дн., поправка на день недели и праздники)`,
      note: `«До» — среднее за ${N} дн. до старта, «после» — среднее за ${N} дн. со старта (не дольше окна). Поправка убирает эффекты дня недели и праздников; сезон (месяц) не поправлен: в данных один год, и сезон неотделим от декабрьских акций. Контрольной группы нет, поэтому это сравнение во времени, а не доказанная причинность. ROI не считается.`,
      columns: [
        { key: 'name', label: 'Акция' },
        { key: 'category', label: 'Категория' },
        { key: 'coverage', label: 'Охват' },
        { key: 'validity', label: 'Срок' },
        { key: 'start', label: 'Старт' },
        { key: 'before', label: `До, л/день (${N} дн.)` },
        { key: 'after', label: `После, л/день (${N} дн.)` },
        { key: 'effect', label: 'Эффект, %' },
        { key: 'seasonal', label: 'С сезонной поправкой, %' },
        { key: 'seasonalNote', label: 'Сезонная поправка' },
      ],
      rows,
    },
  ];
}

// ---------- Дополнительные оценки (5.6 и 5.7) ----------

type Obs = {
  code: string;
  dow: number;
  hol: boolean;
  month: number;
  y: number;
  f: Record<string, number>;
};

/** Панельная регрессия ln(объёма) на именованные признаки с контролями станции, дня недели, праздника (и месяца) */
function fitPooled(
  obs: Obs[],
  names: string[],
  withMonths: boolean
): Record<string, { b: number; t: number | null }> | null {
  if (obs.length < 60) return null;
  const stations = [...new Set(obs.map((o) => o.code))].sort();
  const cols: { name: string; get: (o: Obs) => number }[] = [{ name: 'const', get: () => 1 }];
  for (const n of names) cols.push({ name: n, get: (o) => o.f[n] ?? 0 });
  for (const st of stations.slice(1))
    cols.push({ name: 'st:' + st, get: (o) => (o.code === st ? 1 : 0) });
  for (const dw of [2, 3, 4, 5, 6, 7])
    cols.push({ name: 'dow' + dw, get: (o) => (o.dow === dw ? 1 : 0) });
  cols.push({ name: 'hol', get: (o) => (o.hol ? 1 : 0) });
  if (withMonths)
    for (let m = 2; m <= 12; m++) cols.push({ name: 'm' + m, get: (o) => (o.month === m ? 1 : 0) });
  const X = obs.map((o) => cols.map((c) => c.get(o)));
  const colSum = (j: number) => X.reduce((a, r) => a + r[j], 0);
  // именованные признаки должны меняться; служебные столбцы без вариации убираем
  const idx = cols
    .map((c, j) => j)
    .filter((j) => {
      if (j === 0 || names.includes(cols[j].name)) return true;
      return colSum(j) > 0 && colSum(j) < X.length;
    });
  for (const n of names) {
    const j = cols.findIndex((c) => c.name === n);
    if (new Set(X.map((r) => r[j])).size < 2) return null;
  }
  const Xk = X.map((r) => idx.map((j) => r[j]));
  const k = idx.length;
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < Xk.length; i++)
    for (let a = 0; a < k; a++) {
      Xty[a] += Xk[i][a] * obs[i].y;
      for (let b = 0; b < k; b++) XtX[a][b] += Xk[i][a] * Xk[i][b];
    }
  const inv = invert(XtX);
  if (!inv) return null;
  const beta = inv.map((row) => row.reduce((acc, v, j) => acc + v * Xty[j], 0));
  let rss = 0;
  for (let i = 0; i < Xk.length; i++)
    rss += (obs[i].y - Xk[i].reduce((acc, v, j) => acc + v * beta[j], 0)) ** 2;
  const sigma2 = rss / (Xk.length - k);
  const out: Record<string, { b: number; t: number | null }> = {};
  for (const n of names) {
    const pos = idx.indexOf(cols.findIndex((c) => c.name === n));
    const se = Math.sqrt(sigma2 * inv[pos][pos]);
    out[n] = { b: beta[pos], t: se > 0 ? beta[pos] / se : null };
  }
  return out;
}

/** Дни станций за год с трафиком и погодой; закрытые дни исключены */
async function stationDayObs(codes: string[] | null): Promise<Obs[]> {
  const { rows } = await getPool().query(
    `SELECT f.station_code AS code, f.sale_date::text AS d, sum(f.sales_volume)::float AS vol,
            max(t.cars)::float AS cars, max(w.temperature_c)::float AS temp,
            max(w.precipitation_mm)::float AS precip, max(w.wind_speed_ms)::float AS wind,
            EXTRACT(ISODOW FROM c.cal_date)::int AS dow, c.is_holiday AS hol, c.month AS month
       FROM azs.fuel_daily f
       JOIN azs.calendar c ON c.cal_date = f.sale_date
       LEFT JOIN azs.traffic_daily t ON t.station_code = f.station_code AND t.traffic_date = f.sale_date
       LEFT JOIN azs.weather_daily w ON w.station_code = f.station_code AND w.weather_date = f.sale_date
      WHERE f.sale_date > (SELECT max(sale_date) FROM azs.fuel_daily) - 365 AND ($1::text[] IS NULL OR f.station_code = ANY($1))
      GROUP BY f.station_code, f.sale_date, c.cal_date, c.is_holiday, c.month`,
    [codes]
  );
  const byCode = new Map<string, number[]>();
  for (const r of rows) byCode.set(r.code, [...(byCode.get(r.code) ?? []), r.vol]);
  const med = new Map(
    [...byCode.entries()].map(([c, v]) => {
      const s = [...v].sort((a, b) => a - b);
      return [c, s[Math.floor(s.length / 2)] ?? 0];
    })
  );
  return rows
    .filter((r) => r.vol > 0 && r.vol >= CLOSED_DAY_SHARE * (med.get(r.code) ?? 0))
    .map((r) => ({
      code: r.code,
      dow: Number(r.dow),
      hol: !!r.hol,
      month: Number(r.month),
      y: Math.log(r.vol),
      f: {
        lncars: r.cars && r.cars > 0 ? Math.log(r.cars) : NaN,
        temp: r.temp ?? NaN,
        wind: r.wind ?? NaN,
        rain: r.precip === null ? NaN : r.precip > 0 ? 1 : 0,
      },
    }));
}

/** 5.6: эффекты трафика и погоды, отклонение станций от сети, сезонность, рекомендации по росту */
async function volumeExtra(codes: string[] | null, names: Map<string, string>): Promise<Section[]> {
  const obs = await stationDayObs(codes);
  const trafficObs = obs
    .filter((o) => Number.isFinite(o.f.lncars))
    .map((o) => ({ ...o, f: { lncars: o.f.lncars } }));
  const traffic = fitPooled(trafficObs, ['lncars'], false);
  const weatherObs = obs
    .filter(
      (o) => Number.isFinite(o.f.temp) && Number.isFinite(o.f.rain) && Number.isFinite(o.f.wind)
    )
    .map((o) => ({ ...o, f: { rain: o.f.rain, temp: o.f.temp, wind: o.f.wind } }));
  const weather = fitPooled(weatherObs, ['rain', 'temp', 'wind'], true);
  const pct = (b: number) => round((Math.exp(b) - 1) * 100, 1);
  const verdict = (t: number | null) => (t !== null && Math.abs(t) >= 2 ? 'значимо' : 'не значимо');

  const effectRows: Record<string, any>[] = [];
  if (traffic) {
    const e = traffic.lncars;
    effectRows.push({
      factor: 'Трафик (легковые)',
      effect: `${pct(e.b * Math.log(1.1))}% при +10% ТС`,
      t: round(e.t, 2),
      n: trafficObs.length,
      verdict: verdict(e.t),
    });
  }
  if (weather) {
    effectRows.push({
      factor: 'Осадки (есть/нет)',
      effect: `${pct(weather.rain.b)}%`,
      t: round(weather.rain.t, 2),
      n: weatherObs.length,
      verdict: verdict(weather.rain.t),
    });
    effectRows.push({
      factor: 'Температура, +1 °C',
      effect: `${pct(weather.temp.b)}%`,
      t: round(weather.temp.t, 2),
      n: weatherObs.length,
      verdict: verdict(weather.temp.t),
    });
    effectRows.push({
      factor: 'Ветер, +1 м/с',
      effect: `${pct(weather.wind.b)}%`,
      t: round(weather.wind.t, 2),
      n: weatherObs.length,
      verdict: verdict(weather.wind.t),
    });
  }
  const sections: Section[] = [
    {
      title: 'Влияние трафика и погоды на объём (панель станций, с контролями)',
      note: 'Регрессия ln(объёма) с фиксированными эффектами станций, днём недели и праздником; для погоды добавлен месяц. Трафик доступен только с февраля 2026 года, поэтому его оценка опирается на более короткий период. Значимо при |t| ≥ 2.',
      columns: [
        { key: 'factor', label: 'Фактор' },
        { key: 'effect', label: 'Эффект на объём' },
        { key: 't', label: 't' },
        { key: 'n', label: 'Наблюдений' },
        { key: 'verdict', label: 'Вывод' },
      ],
      rows: effectRows,
    },
  ];

  // отклонение станций от сети: средний объём станции-дня к среднему по сети
  const perStation = new Map<string, number[]>();
  for (const o of obs) perStation.set(o.code, [...(perStation.get(o.code) ?? []), Math.exp(o.y)]);
  const all = [...perStation.values()].flat();
  const netAvg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
  sections.push({
    title: 'Станции относительно сети (средний объём станции-дня за год)',
    columns: [
      { key: 'station', label: 'АЗС' },
      { key: 'avg', label: 'Средний объём, л/день' },
      { key: 'vsNet', label: 'Отклонение от сети, %' },
    ],
    rows: [...perStation.entries()].map(([code, xs]) => {
      const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
      return {
        station: names.get(code) ?? code,
        avg: round(avg, 0),
        vsNet: netAvg ? round((avg / netAvg - 1) * 100, 1) : null,
      };
    }),
  });

  // сезонность: средний объём сети по месяцам относительно среднего месяца (один год данных)
  const { rows: monthly } = await getPool().query(
    `SELECT c.month AS m, avg(d.t)::float AS avg_t, count(*)::int AS n,
            count(DISTINCT EXTRACT(YEAR FROM c.cal_date))::int AS years FROM (
       SELECT sale_date, sum(sales_volume)::float AS t FROM azs.fuel_daily GROUP BY sale_date) d
       JOIN azs.calendar c ON c.cal_date = d.sale_date GROUP BY c.month ORDER BY c.month`
  );
  const monthAvg = monthly.reduce((a, r) => a + r.avg_t, 0) / (monthly.length || 1);
  // сезонный индекс показываем, только если каждый месяц наблюдён минимум в двух годах; иначе это не сезон, а одно событие
  const seasonReady = monthly.length > 0 && monthly.every((r) => r.years >= 2);
  sections.push({
    title: 'Сезонность: объём сети по месяцам (отклонение от среднего месяца)',
    note: seasonReady
      ? 'Отклонение месяца от среднего месяца по сети. Это описание, а не проверенная сезонная модель.'
      : 'Сезонность не показана: для части месяцев есть только один год данных (нужно минимум два года на каждый месяц).',
    columns: [
      { key: 'month', label: 'Месяц' },
      { key: 'index', label: 'Отклонение, %' },
      { key: 'days', label: 'Дней' },
    ],
    rows: seasonReady
      ? monthly.map((r) => ({
          month: String(r.m).padStart(2, '0'),
          index: round((r.avg_t / monthAvg - 1) * 100, 1),
          days: r.n,
        }))
      : [],
  });

  // рекомендации по росту из значимых оценок
  const recs: Record<string, any>[] = [];
  if (traffic && Math.abs(traffic.lncars.t ?? 0) >= 2 && traffic.lncars.b > 0) {
    recs.push({
      text: `Рост трафика на 10% даёт около ${pct(traffic.lncars.b * Math.log(1.1))}% объёма: приоритет — привлечение машин (сервис, парковка, точки у трассы).`,
    });
  }
  if (weather && Math.abs(weather.rain.t ?? 0) >= 2 && weather.rain.b < 0) {
    recs.push({
      text: `В дождливые дни объём ниже примерно на ${round(-pct(weather.rain.b), 1)}%: в такие дни имеет смысл усиливать предложения для машин на заправке (кафе, магазин).`,
    });
  }
  if (!recs.length)
    recs.push({
      text: 'Значимых факторов роста на текущих данных нет. Для выводов нужен больший период или контролируемый тест.',
    });
  sections.push({
    title: 'Рекомендации по росту объёма',
    columns: [{ key: 'text', label: 'Рекомендация' }],
    rows: recs,
  });
  return sections;
}

/** 5.7: что влияет на выручку магазина на 1000 л топлива; ценовая политика по категориям недоступна */
async function shopExtra(codes: string[] | null): Promise<Section[]> {
  const { rows } = await getPool().query(
    `WITH sd AS (
       SELECT station_code, sale_date, sum(sales_volume)::float AS liters FROM azs.fuel_daily
        WHERE sale_date > (SELECT max(sale_date) FROM azs.fuel_daily) - 365 AND ($1::text[] IS NULL OR station_code = ANY($1))
        GROUP BY 1, 2),
     sh AS (
       SELECT station_code, sale_date, sum(revenue_rub)::float AS rev FROM azs.shop_sales_daily
        WHERE sale_date > (SELECT max(sale_date) FROM azs.shop_sales_daily) - 365 AND ($1::text[] IS NULL OR station_code = ANY($1))
        GROUP BY 1, 2)
     SELECT sd.station_code, sd.liters, sh.rev, c.is_holiday AS hol,
            EXTRACT(ISODOW FROM c.cal_date)::int AS dow, w.temperature_c::float AS temp
       FROM sd JOIN sh USING (station_code, sale_date)
       JOIN azs.calendar c ON c.cal_date = sd.sale_date
       LEFT JOIN azs.weather_daily w ON w.station_code = sd.station_code AND w.weather_date = sd.sale_date
      WHERE sd.liters > 0`,
    [codes]
  );
  const agg = (key: (r: any) => string | null) => {
    const m = new Map<string, { rev: number; l: number; n: number }>();
    for (const r of rows) {
      const k = key(r);
      if (k === null) continue;
      const a = m.get(k) ?? { rev: 0, l: 0, n: 0 };
      a.rev += r.rev;
      a.l += r.liters;
      a.n += 1;
      m.set(k, a);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([k, a]) => ({
        group: k,
        per1000: round((a.rev / a.l) * 1000, 0),
        n: a.n,
        reliable: a.n >= 30 ? 'да' : 'мало данных',
      }));
  };
  const wd = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const tb = (t: number | null) =>
    t === null
      ? null
      : t < 0
        ? 'ниже 0 °C'
        : t < 10
          ? '0…10 °C'
          : t < 20
            ? '10…20 °C'
            : '20 °C и выше';
  return [
    {
      title: 'Выручка магазина на 1000 л топлива: факторы спроса',
      note: 'Показатель «₽ на 1000 л» по группам дней. Группы с менее чем 30 наблюдениями помечены. Причинность не доказывается.',
      columns: [
        { key: 'factor', label: 'Фактор' },
        { key: 'group', label: 'Группа' },
        { key: 'per1000', label: '₽ на 1000 л' },
        { key: 'n', label: 'Дней' },
        { key: 'reliable', label: 'Надёжно' },
      ],
      rows: [
        ...agg((r) => `${r.dow}-${wd[(r.dow - 1) % 7]}`).map((x) => ({
          factor: 'День недели',
          ...x,
        })),
        ...agg((r) => (r.hol ? 'праздник' : 'обычный день')).map((x) => ({
          factor: 'Праздники',
          ...x,
        })),
        ...agg((r) => tb(r.temp)).map((x) => ({ factor: 'Температура', ...x })),
      ],
    },
    {
      title: 'Ценовая политика по категориям товаров и симулятор цены категории',
      note: 'Недоступно: в данных нет цен на товары магазина (только выручка по группам), поэтому ценовые коэффициенты по категориям и симулятор не строятся. Нужна выгрузка цен и количеств по товарам.',
      columns: [{ key: 'text', label: 'Статус' }],
      rows: [],
    },
  ];
}

/** Графики для вкладок, где их не было: тренды цен, спроса, объёма, выручки и акций */
async function attachCharts(
  tab: string,
  sections: Section[],
  codes: string[] | null,
  names: Map<string, string>
) {
  const pool = getPool();
  const first = sections[0];
  if (!first) return;
  if (tab === 'prices') {
    // цена по каждой станции и топливу (без усреднения по сети)
    const { rows } = await pool.query(
      `SELECT station_code, fuel_code, sale_date::text AS d, price::float AS price FROM azs.fuel_daily
        WHERE price > 0 AND fuel_code = ANY($2)
          AND sale_date > (SELECT max(sale_date) FROM azs.fuel_daily) - 90 AND ($1::text[] IS NULL OR station_code = ANY($1))
        ORDER BY 3`,
      [codes, FUELS_CHART]
    );
    first.chart = toChart(
      rows.map((r) => ({
        series: `${names.get(r.station_code) ?? r.station_code} · ${r.fuel_code}`,
        date: r.d,
        value: r.price,
      })),
      '₽/л'
    );
  } else if (tab === 'factors') {
    const { rows } = await pool.query(
      `WITH sd AS (SELECT station_code, sale_date, sum(sales_volume)::float AS l FROM azs.fuel_daily
                    WHERE sale_date > (SELECT max(sale_date) FROM azs.fuel_daily) - 365 AND ($1::text[] IS NULL OR station_code = ANY($1))
                    GROUP BY 1, 2)
       SELECT EXTRACT(ISODOW FROM c.cal_date)::int AS dow, avg(sd.l)::float AS avg_l FROM sd JOIN azs.calendar c ON c.cal_date = sd.sale_date
        GROUP BY 1 ORDER BY 1`,
      [codes]
    );
    const wd = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    first.chart = {
      labels: rows.map((r) => wd[(r.dow - 1) % 7]),
      datasets: [{ label: 'л/день, среднее', data: rows.map((r) => round(r.avg_l, 0)) }],
      yLabel: 'л/день',
    };
  } else if (tab === 'volume') {
    const { rows } = await pool.query(
      `SELECT station_code, sale_date::text AS d, sum(sales_volume)::float AS l FROM azs.fuel_daily
        WHERE sale_date > (SELECT max(sale_date) FROM azs.fuel_daily) - 60 AND ($1::text[] IS NULL OR station_code = ANY($1))
        GROUP BY 1, 2 ORDER BY 2`,
      [codes]
    );
    first.chart = toChart(
      rows.map((r) => ({
        series: names.get(r.station_code) ?? r.station_code,
        date: r.d,
        value: r.l,
      })),
      'л/день'
    );
  } else if (tab === 'shop') {
    const { rows } = await pool.query(
      `SELECT to_char(date_trunc('month', sale_date), 'YYYY-MM') AS m, sum(revenue_rub)::float AS rev FROM azs.shop_sales_daily
        WHERE sale_date > (SELECT max(sale_date) FROM azs.shop_sales_daily) - 365 AND ($1::text[] IS NULL OR station_code = ANY($1))
        GROUP BY 1 ORDER BY 1`,
      [codes]
    );
    const monthSection = sections[2] ?? first;
    monthSection.chart = {
      labels: rows.map((r) => r.m),
      datasets: [{ label: 'выручка магазина, ₽', data: rows.map((r) => round(r.rev, 0)) }],
      yLabel: '₽',
    };
  } else if (tab === 'promotions') {
    const { rows } = await pool.query(
      `SELECT sale_date::text AS d, sum(sales_volume)::float AS l FROM azs.fuel_daily
        WHERE sale_date > (SELECT max(sale_date) FROM azs.fuel_daily) - 180 GROUP BY 1 ORDER BY 1`
    );
    first.chart = toChart(
      rows.map((r) => ({ series: 'сеть, л/день', date: r.d, value: r.l })),
      'л/день (вся сеть)'
    );
  }
}

/** Вкладка по имени; allowedIds — станции пользователя (null — все), azsId — фильтр одной станции */
export const ELASTICITY_WINDOWS = [7, 28, 90, 365];

export async function analyticsTab(
  tab: string,
  allowedIds: string[] | null,
  azsId?: string,
  elasticityDays?: number,
  promoWindow?: number
): Promise<TabResult> {
  const { codes, names } = await scopeCodes(allowedIds, azsId);
  const asOf = await asOfDate();
  let sections: Section[];
  switch (tab) {
    case 'prices':
      sections = await prices(codes, names, elasticityDays);
      break;
    case 'competitors': {
      const compEl = await compElasticityRows(asOf ?? '', names);
      const scoped = codes
        ? compEl.filter((r) => codes.some((c) => names.get(c) === r.station))
        : compEl;
      sections = [
        ...(await competitors(codes, names)),
        {
          title: 'Эластичность объёма к цене конкурентов (COMP-003)',
          note: 'Регрессия ln(объёма) на ln(медианы цен конкурентов за 14 дней), контроль: день недели. «Значимо» — |t| ≥ 2. Отрицательная эластичность: рост цен конкурентов увеличивает объём станции.',
          columns: [
            { key: 'station', label: 'АЗС' },
            { key: 'fuel', label: 'Топливо' },
            { key: 'elasticity', label: 'Эластичность к цене конкурентов' },
            { key: 't', label: 't' },
            { key: 'n', label: 'Наблюдений' },
            { key: 'lagElasticity', label: 'Эластичность с лагом 7 дн.' },
            { key: 'lagT', label: 't с лагом' },
            { key: 'verdict', label: 'Вывод' },
          ],
          rows: scoped,
        },
      ];
      break;
    }
    case 'traffic':
      sections = await traffic(codes, names);
      break;
    case 'factors':
      sections = await factors(codes);
      break;
    case 'volume':
      sections = [...(await volume(codes, names)), ...(await volumeExtra(codes, names))];
      break;
    case 'shop':
      sections = [...(await shop(codes, names)), ...(await shopExtra(codes))];
      break;
    case 'promotions':
      sections = await promotions(promoWindow);
      break;
    default:
      throw Object.assign(new Error('Неизвестная вкладка'), { status: 404 });
  }
  await attachCharts(tab, sections, codes, names);
  return { tab, asOf, sections };
}
