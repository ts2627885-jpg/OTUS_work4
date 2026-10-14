/**
 * Дополнительные правила AI_Agent_Rules, которые считаются по имеющимся данным:
 *   COMP-002   тренд цен конкурентов за 120 дней (линейная регрессия по неделям)
 *   COMP-003   чувствительность объёма к цене конкурентов (эластичность по конкурентам)
 *   TRAFFIC-001 падение доли станции в сети (прокси захвата: рынок не измерен)
 *   TRAFFIC-003 качество данных трафика (аномально низкие или пропущенные значения)
 *   PROMO-002  слабые дни недели для акций
 *   SHOP-001   ABC-анализ товаров магазина по выручке
 * Правила, которые нельзя посчитать (PRICE-003, PRICE-005, PROMO-001, SHOP-002..004), см. notComputed в rules.service.
 */
import { getPool } from '@config/database';
import { invert } from '@services/elasticity.service';

export type ExtraPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface ExtraRec {
  id: string;
  rule: string;
  title: string;
  station: string;
  fuel: string | null;
  priority: ExtraPriority;
  effect: string;
  action: string;
  reason: string;
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Детерминированный генератор случайных чисел (для воспроизводимого бутстрапа) */
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

/** 95% доверительный интервал наклона по бутстрапу (пересэмплирование пар неделя–цена) */
function bootstrapSlopeCI(
  x: number[],
  y: number[],
  seed: number,
  reps = 500
): [number, number] | null {
  const rand = rng(seed);
  const slopes: number[] = [];
  for (let r = 0; r < reps; r++) {
    const xs: number[] = [],
      ys: number[] = [];
    for (let i = 0; i < x.length; i++) {
      const j = Math.floor(rand() * x.length);
      xs.push(x[j]);
      ys.push(y[j]);
    }
    const reg = linreg(xs, ys);
    if (reg) slopes.push(reg.slope);
  }
  if (slopes.length < reps * 0.8) return null;
  slopes.sort((a, b) => a - b);
  return [slopes[Math.floor(0.025 * slopes.length)], slopes[Math.floor(0.975 * slopes.length)]];
}

/** Простая регрессия: наклон, R² */
function linreg(x: number[], y: number[]): { slope: number; r2: number } | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n,
    my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return { slope: sxy / sxx, r2: (sxy * sxy) / (sxx * syy) };
}

/** COMP-002: тренд цен конкурентов по неделям за 120 дней (R² > 0.5, наклон > 5 копеек в неделю) */
async function compTrend(asOf: string, names: Map<string, string>): Promise<ExtraRec[]> {
  const { rows } = await getPool().query(
    `SELECT c.station_code, c.brand, cp.fuel_code, date_trunc('week', cp.observed_at)::date::text AS wk, avg(cp.price)::float AS p
       FROM azs.competitor_price cp JOIN azs.competitor c USING (competitor_id)
      WHERE cp.is_offered AND cp.price > 0 AND cp.observed_at::date > $1::date - 120 AND cp.observed_at::date <= $1::date
      GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4`,
    [asOf]
  );
  const series = new Map<
    string,
    { code: string; brand: string; fuel: string; weeks: number[]; prices: number[] }
  >();
  for (const r of rows) {
    const key = `${r.station_code}|${r.brand}|${r.fuel_code}`;
    const s = series.get(key) ?? {
      code: r.station_code,
      brand: r.brand,
      fuel: r.fuel_code,
      weeks: [],
      prices: [],
    };
    s.weeks.push(new Date(r.wk).getTime() / (7 * 86400000));
    s.prices.push(r.p);
    series.set(key, s);
  }
  // значимые тренды по брендам, объединённые по станции и топливу: одна рекомендация на пару
  const grouped = new Map<
    string,
    { code: string; fuel: string; brands: string[]; slopes: number[]; r2: number[] }
  >();
  for (const s of series.values()) {
    if (s.weeks.length < 12) continue;
    const reg = linreg(s.weeks, s.prices);
    // порог относительный: 0.5% цены в неделю (для цен 60–90 ₽ это 0.3–0.45 ₽), R² > 0.5
    const meanPrice = s.prices.reduce((a, b) => a + b, 0) / s.prices.length;
    if (!reg || reg.r2 <= 0.5 || Math.abs(reg.slope) / meanPrice < 0.005) continue;
    // бутстрап: 95% интервал наклона не должен содержать ноль
    const seed = [...`${s.code}|${s.fuel}|${s.brand}`].reduce(
      (h, c) => (h * 31 + c.charCodeAt(0)) >>> 0,
      7
    );
    const ci = bootstrapSlopeCI(s.weeks, s.prices, seed);
    if (!ci || ci[0] * ci[1] <= 0) continue;
    const key = `${s.code}|${s.fuel}`;
    const g = grouped.get(key) ?? { code: s.code, fuel: s.fuel, brands: [], slopes: [], r2: [] };
    g.brands.push(s.brand);
    g.slopes.push(reg.slope);
    g.r2.push(reg.r2);
    grouped.set(key, g);
  }
  const out: ExtraRec[] = [];
  for (const g of grouped.values()) {
    const sorted = [...g.slopes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const up = median > 0;
    // тренды должны совпадать по направлению у большинства брендов
    const agree = g.slopes.filter((x) => x > 0 === up).length;
    // минимум два бренда с одинаковым направлением; одиночный бренд — шум
    if (agree < 2 || agree * 2 < g.slopes.length) continue;
    out.push({
      id: `COMP-002-${g.code}-${g.fuel}`,
      rule: 'COMP-002',
      title: up ? 'Конкуренты повышают цену' : 'Конкуренты снижают цену',
      station: names.get(g.code) ?? g.code,
      fuel: g.fuel,
      priority: up ? 'MEDIUM' : 'LOW',
      effect: `Медианный тренд ${up ? '+' : ''}${round(median, 2)} ₽/неделю (${g.brands.length} брендов, R² от ${round(Math.min(...g.r2), 2)})`,
      action: up
        ? 'Подготовиться к повышению цены синхронно с рынком'
        : 'Оценить, нужна ли реакция на снижение цен конкурентов',
      reason: `Линейный тренд по неделям за 120 дней: ${g.brands.join(', ')}`,
    });
  }
  return out;
}

/** Суточные медианы конкурентов по станции и топливу; сглаживание — среднее за 14 дней */
/** Регрессия ln(объёма) на ln(цены конкурентов) с контролем дня недели. Возвращает коэффициент и t или причину отказа */
function fitCompElasticity(
  obs: any[],
  comp: (o: any) => number
): { elasticity: number; t: number } | string {
  const xs = obs.map((o) => Math.log(comp(o)));
  if (new Set(xs.map((x) => round(x, 4))).size < 5) return 'нет вариации цены конкурентов';
  const X = obs.map((o, i) => {
    const row = [1, xs[i]];
    for (const dw of [2, 3, 4, 5, 6, 7]) row.push(o.dow === dw ? 1 : 0);
    return row;
  });
  const y = obs.map((o) => Math.log(o.v));
  const kk = X[0].length;
  const XtX = Array.from({ length: kk }, () => new Array(kk).fill(0));
  const Xty = new Array(kk).fill(0);
  for (let i = 0; i < X.length; i++)
    for (let a = 0; a < kk; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < kk; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  const inv = invert(XtX);
  if (!inv) return 'матрица вырождена';
  const beta = inv.map((row) => row.reduce((acc, v, j) => acc + v * Xty[j], 0));
  let rss = 0;
  for (let i = 0; i < X.length; i++)
    rss += (y[i] - X[i].reduce((acc, v, j) => acc + v * beta[j], 0)) ** 2;
  const se = Math.sqrt((rss / (obs.length - kk)) * inv[1][1]);
  if (!(se > 0)) return 'не оценено';
  return { elasticity: beta[1], t: beta[1] / se };
}

export async function compElasticityRows(asOf: string, names: Map<string, string>) {
  // Суточные медианы конкурентов соединяются с продажами диапазонами дат (окна 14 и 7–21 дней).
  // Прежний вариант с коррелированными подзапросами считал ~6 с; соединение с агрегатом — ~0,3 с.
  const { rows } = await getPool().query(
    `WITH cd AS (
       SELECT c.station_code, cp.fuel_code, cp.observed_at::date AS d, percentile_cont(0.5) WITHIN GROUP (ORDER BY cp.price)::float AS med
         FROM azs.competitor_price cp JOIN azs.competitor c USING (competitor_id)
        WHERE cp.is_offered AND cp.price > 0 GROUP BY 1, 2, 3),
     base AS (
       SELECT f.station_code, f.fuel_code, f.sale_date, f.sales_volume, EXTRACT(ISODOW FROM c.cal_date)::int AS dow
         FROM azs.fuel_daily f JOIN azs.calendar c ON c.cal_date = f.sale_date
        WHERE f.fuel_code IN ('AI92', 'AI95', 'DT') AND f.sales_volume > 0
          AND f.sale_date > $1::date - 365 AND f.sale_date <= $1::date),
     win AS (
       SELECT b.station_code, b.fuel_code, b.sale_date,
              avg(cd.med) FILTER (WHERE cd.d > b.sale_date - 14 AND cd.d <= b.sale_date) AS comp,
              avg(cd.med) FILTER (WHERE cd.d > b.sale_date - 21 AND cd.d <= b.sale_date - 7) AS comp_lag
         FROM base b JOIN cd ON cd.station_code = b.station_code AND cd.fuel_code = b.fuel_code
                            AND cd.d > b.sale_date - 21 AND cd.d <= b.sale_date
        GROUP BY 1, 2, 3)
     SELECT b.station_code, b.fuel_code, b.sale_date::text AS d, b.sales_volume::float AS v, b.dow,
            w.comp::float AS comp, w.comp_lag::float AS comp_lag
       FROM base b LEFT JOIN win w USING (station_code, fuel_code, sale_date)`,
    [asOf]
  );
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    if (r.comp === null || r.comp <= 0) continue;
    const k = `${r.station_code}|${r.fuel_code}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const result: {
    station: string;
    fuel: string;
    elasticity: number | null;
    t: number | null;
    n: number;
    verdict: string;
    lagElasticity: number | null;
    lagT: number | null;
  }[] = [];
  for (const [k, obs] of groups.entries()) {
    const [code, fuel] = k.split('|');
    const n = obs.length;
    const name = names.get(code) ?? code;
    const none = { lagElasticity: null, lagT: null };
    if (n < 60) {
      result.push({
        station: name,
        fuel,
        elasticity: null,
        t: null,
        n,
        verdict: 'мало наблюдений',
        ...none,
      });
      continue;
    }
    const fit = fitCompElasticity(obs, (o) => o.comp);
    if (typeof fit === 'string') {
      result.push({ station: name, fuel, elasticity: null, t: null, n, verdict: fit, ...none });
      continue;
    }
    const reliable = Math.abs(fit.t) >= 2;
    // проверка обратной причинности: цена конкурентов неделей раньше (лаг 7 дней)
    const lagObs = obs.filter((o) => o.comp_lag !== null && o.comp_lag > 0);
    const lag = lagObs.length >= 60 ? fitCompElasticity(lagObs, (o) => o.comp_lag) : null;
    const lagOk = lag !== null && typeof lag !== 'string';
    let verdict = reliable
      ? fit.elasticity < 0
        ? 'значимо'
        : 'значимо, положительная (нужна проверка)'
      : 'не значимо';
    if (reliable && fit.elasticity >= 0) {
      // лаг меняет знак: реакция на цену конкурентов; лаг сохраняет знак: связь не объясняется реакцией, скорее общий тренд спроса
      verdict =
        lagOk && lag.elasticity < 0
          ? 'значимо, положительная при одновременной цене; с лагом 7 дн. отрицательная: возможна обратная причинность'
          : 'значимо, положительная и с лагом 7 дн.: скорее общий тренд спроса или сезон, не реакция на цену (нужна проверка)';
    }
    result.push({
      station: name,
      fuel,
      elasticity: round(fit.elasticity, 2),
      t: round(fit.t, 2),
      n,
      verdict,
      lagElasticity: lagOk ? round(lag.elasticity, 2) : null,
      lagT: lagOk ? round(lag.t, 2) : null,
    });
  }
  return result;
}

/** COMP-003: чувствительность к ценам конкурентов — правило по значимым отрицательным оценкам */
async function compSensitivity(
  asOf: string,
  names: Map<string, string>
): Promise<{ recs: ExtraRec[]; rows: any[] }> {
  const rows = await compElasticityRows(asOf, names);
  const recs: ExtraRec[] = [];
  for (const r of rows) {
    if (r.verdict !== 'значимо' || r.elasticity === null || r.elasticity >= -0.8) continue;
    recs.push({
      id: `COMP-003-${r.station}-${r.fuel}`,
      rule: 'COMP-003',
      title:
        r.elasticity < -1.5
          ? 'Очень высокая чувствительность к ценам конкурентов'
          : 'Высокая чувствительность к ценам конкурентов',
      station: r.station,
      fuel: r.fuel,
      priority: r.elasticity < -1.5 ? 'HIGH' : 'MEDIUM',
      effect: `Эластичность к цене конкурентов ${r.elasticity} (t ${r.t}): рост цены конкурентов на 1% → объём ${r.elasticity}%`,
      action:
        'Отслеживать цены конкурентов в режиме, близком к реальному времени; подготовить варианты реакции',
      reason: `Регрессия за год по дням, контроль: день недели; n=${r.n}`,
    });
  }
  return { recs, rows };
}

/** TRAFFIC-001 (прокси): падение доли станции в объёме сети на 8% и больше за 28 дней */
async function shareDrop(asOf: string, names: Map<string, string>): Promise<ExtraRec[]> {
  const { rows } = await getPool().query(
    `SELECT station_code,
            sum(CASE WHEN sale_date > $1::date - 28 THEN sales_volume END)::float AS cur,
            sum(CASE WHEN sale_date <= $1::date - 28 AND sale_date > $1::date - 56 THEN sales_volume END)::float AS prev
       FROM azs.fuel_daily WHERE sale_date > $1::date - 56 AND sale_date <= $1::date GROUP BY station_code`,
    [asOf]
  );
  const curTot = rows.reduce((a, r) => a + (r.cur ?? 0), 0),
    prevTot = rows.reduce((a, r) => a + (r.prev ?? 0), 0);
  const out: ExtraRec[] = [];
  for (const r of rows) {
    if (!r.cur || !r.prev || !curTot || !prevTot) continue;
    const shareCur = r.cur / curTot,
      sharePrev = r.prev / prevTot;
    const rel = (shareCur / sharePrev - 1) * 100;
    if (rel > -8) continue;
    out.push({
      id: `TRAFFIC-001-${r.station_code}`,
      rule: 'TRAFFIC-001',
      title: 'Падение доли станции в сети',
      station: names.get(r.station_code) ?? r.station_code,
      fuel: null,
      priority: 'MEDIUM',
      effect: `Доля в объёме сети ${round(sharePrev * 100, 1)}% → ${round(shareCur * 100, 1)}% (${round(rel, 1)}%)`,
      action: 'Проверить цены относительно конкурентов и причины падения трафика на станции',
      reason: 'Прокси захвата: рынок не измерен, оценка относительно сети',
    });
  }
  return out;
}

/** TRAFFIC-003: качество данных трафика по станциям */
async function trafficQuality(asOf: string, names: Map<string, string>): Promise<ExtraRec[]> {
  const { rows } = await getPool().query(
    `SELECT station_code, avg(cars)::float AS avg_cars, count(*)::int AS days
       FROM azs.traffic_daily WHERE traffic_date > $1::date - 28 AND traffic_date <= $1::date GROUP BY station_code`,
    [asOf]
  );
  const meds = rows.map((r) => r.avg_cars).sort((a, b) => a - b);
  const median = meds.length ? meds[Math.floor(meds.length / 2)] : 0;
  const out: ExtraRec[] = [];
  for (const r of rows) {
    const name = names.get(r.station_code) ?? r.station_code;
    if (median > 0 && r.avg_cars < 0.2 * median) {
      out.push({
        id: `TRAFFIC-003-${r.station_code}`,
        rule: 'TRAFFIC-003',
        title: 'Аномально низкий трафик: проверить датчики',
        station: name,
        fuel: null,
        priority: 'HIGH',
        effect: `Легковые ${round(r.avg_cars, 0)} в день при медиане сети ${round(median, 0)}`,
        action:
          'Проверить датчики трафика и выгрузку; показатели по трафику для станции не использовать до проверки',
        reason: 'Значение меньше 20% медианы станций за 28 дней',
      });
    } else if (r.days < 25) {
      out.push({
        id: `TRAFFIC-003-GAP-${r.station_code}`,
        rule: 'TRAFFIC-003',
        title: 'Пропуски в данных трафика',
        station: name,
        fuel: null,
        priority: 'MEDIUM',
        effect: `Данных о трафике ${r.days} из 28 дней`,
        action: 'Проверить выгрузку трафика за последние 28 дней',
        reason: 'Пропуски больше 10% дней',
      });
    }
  }
  return out;
}

/** PROMO-002: дни недели с объёмом сети ниже 85% среднего — слабые дни для акций */
async function weakWeekdays(asOf: string): Promise<ExtraRec[]> {
  const { rows } = await getPool().query(
    `SELECT EXTRACT(ISODOW FROM d.sale_date)::int AS dow, avg(d.t)::float AS avg_t, count(*)::int AS n FROM (
       SELECT sale_date, sum(sales_volume)::float AS t FROM azs.fuel_daily
        WHERE sale_date > $1::date - 180 AND sale_date <= $1::date GROUP BY sale_date) d
      GROUP BY 1 ORDER BY 1`,
    [asOf]
  );
  const total = rows.reduce((a, r) => a + r.avg_t, 0) / (rows.length || 1);
  const wd = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const weak = rows.filter((r) => r.avg_t < 0.85 * total);
  if (!weak.length) return [];
  return [
    {
      id: 'PROMO-002-NETWORK',
      rule: 'PROMO-002',
      title: 'Слабые дни недели для акций',
      station: 'Вся сеть',
      fuel: null,
      priority: 'LOW',
      effect: `Дни с объёмом ниже 85% среднего: ${weak.map((r) => wd[(r.dow - 1) % 7]).join(', ')}`,
      action: 'Планировать акции на слабые дни недели: там эффект от скидки выше',
      reason: 'Средний объём сети по дням недели за 180 дней',
    },
  ];
}

/** SHOP-001: ABC-анализ товаров магазина по выручке за год */
async function shopAbc(asOf: string): Promise<ExtraRec[]> {
  const { rows } = await getPool().query(
    `SELECT product_code, sum(revenue_rub)::float AS rev FROM azs.shop_sales_daily
      WHERE sale_date > $1::date - 365 AND sale_date <= $1::date GROUP BY product_code ORDER BY rev DESC`,
    [asOf]
  );
  const total = rows.reduce((a, r) => a + r.rev, 0);
  if (!total) return [];
  let cum = 0;
  const cat: Record<string, string[]> = { A: [], B: [], C: [] };
  for (const r of rows) {
    cum += r.rev / total;
    const k = cum - r.rev / total < 0.8 ? 'A' : cum <= 0.95 ? 'B' : 'C';
    cat[k].push(r.product_code.replace(/^shop_/, ''));
  }
  return [
    {
      id: 'SHOP-001-NETWORK',
      rule: 'SHOP-001',
      title: 'ABC-анализ товаров магазина',
      station: 'Вся сеть',
      fuel: null,
      priority: 'LOW',
      effect: `A (80% выручки): ${cat.A.join(', ') || '—'}; B: ${cat.B.join(', ') || '—'}; C: ${cat.C.join(', ') || '—'}`,
      action:
        'Категорию A держать в наличии и защищать цену; B поддерживать акциями; C рассмотреть сокращение',
      reason: 'Выручка магазина по категориям за 365 дней',
    },
  ];
}

export async function extraRules(asOf: string, names: Map<string, string>) {
  const [comp, sens, share, quality, weak, abc] = await Promise.all([
    compTrend(asOf, names),
    compSensitivity(asOf, names),
    shareDrop(asOf, names),
    trafficQuality(asOf, names),
    weakWeekdays(asOf),
    shopAbc(asOf),
  ]);
  return {
    recs: [...comp, ...sens.recs, ...share, ...quality, ...weak, ...abc],
    compElasticity: sens.rows,
  };
}
