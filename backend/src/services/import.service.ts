/**
 * Импорт CSV в схему azs. Тип файла определяется по заголовку.
 * Преобразования повторяют пайплайн _BD/pipeline (load_all.py, load_competitor_prices.py,
 * clean_promotions.py, transform.sql), но запись идёт не полной пересборкой, а upsert:
 * повторная загрузка того же файла обновляет строки, а не дублирует их.
 *
 * Поддерживаемые файлы: stations, prices, traffic, weather, competitors, shop, promotions.
 * stations.csv создаёт или обновляет АЗС в azs.station; после загрузки синхронизация public (см. routes/import.routes.ts).
 */
import type { PoolClient } from 'pg';
import { getPool } from '@config/database';
import { logger } from '@utils/logger';
import { createBackup } from '@services/backup.service';
import { generateRecommendations, GenerateResult } from '@services/recommendations.service';
import { clearRulesCache } from '@services/rules.service';
import { clearElasticityCache } from '@services/elasticity.service';

export type ImportType =
  'stations' | 'prices' | 'traffic' | 'weather' | 'competitors' | 'shop' | 'promotions';

export interface ImportResult {
  fileName: string;
  type: ImportType;
  rows: number; // строк прочитано из файла
  written: number; // строк записано в таблицы
  skipped: number; // строк пропущено (нет станции в справочнике, пустые значения)
  unknownStations: string[];
  tables: Record<string, number>;
  recommendations?: GenerateResult | { error: string }; // пересчёт после импорта
}

const MONTHS: Record<string, string> = {
  янв: '01',
  фев: '02',
  мар: '03',
  апр: '04',
  май: '05',
  июн: '06',
  июл: '07',
  авг: '08',
  сен: '09',
  окт: '10',
  ноя: '11',
  дек: '12',
};

// ---------- CSV ----------

function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function readCsv(buffer: Buffer): { headers: string[]; records: Record<string, string>[] } {
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.split(/\r?\n/)[0];
  const delim =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const [headers, ...body] = parseCsv(text, delim);
  const hs = headers.map((h) => h.trim());
  const records = body.map((r) => Object.fromEntries(hs.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { headers: hs, records };
}

export function detectType(headers: string[]): ImportType | null {
  const h = new Set(headers);
  if (h.has('station_id') && h.has('station_name') && h.has('road_type')) return 'stations';
  if (h.has('sales_AI92') && h.has('price_AI92')) return 'prices';
  if (h.has('traffic_Passengers_cars')) return 'traffic';
  if (h.has('station_name') && h.has('temperature_C')) return 'weather';
  if (h.has('Наименование групп данных') && h.has('Переменная')) return 'competitors';
  if (h.has('Наименование групп') && h.has('АЗС')) return 'shop';
  if (h.has('ВИНК') && h.has('Акция')) return 'promotions';
  return null;
}

// ---------- преобразования значений ----------

const num = (v?: string | null): number | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Код станции: последние три цифры названия (АЗС 172 → 172, Запад-МФ-6910172 → 172) */
const stCode = (s?: string | null): string | null => {
  const m = (s || '').match(/(\d{3})\D*$/);
  return m ? m[1] : null;
};

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7
    )
  );
}

const seasonOf = (m: number) =>
  [12, 1, 2].includes(m)
    ? 'зима'
    : [3, 4, 5].includes(m)
      ? 'весна'
      : [6, 7, 8].includes(m)
        ? 'лето'
        : 'осень';

/** Календарная запись для даты из файла (нужна для внешнего ключа) */
function calendarRow(
  iso: string,
  extra?: { season?: string; isWeekend?: boolean; isHoliday?: boolean; holidayName?: string | null }
) {
  const d = new Date(iso + 'T00:00:00Z');
  const m = d.getUTCMonth() + 1;
  return [
    iso,
    ((d.getUTCDay() + 6) % 7) + 1,
    isoWeek(d),
    m,
    Math.ceil(m / 3),
    d.getUTCFullYear(),
    extra?.season || seasonOf(m),
    extra?.isWeekend ?? [0, 6].includes(d.getUTCDay()),
    extra?.isHoliday ?? false,
    extra?.holidayName ?? null,
  ];
}

/** «27.апр» → 27.04; обычное число → число (повтор логики parse_price из load_competitor_prices.py) */
function parsePrice(raw?: string | null): number | null {
  if (!raw) return null;
  const s = raw.trim().replace(',', '.');
  const m = s.match(/^(\d+)\.([а-яА-Я]{3})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return Number(`${m[1]}.${MONTHS[m[2].toLowerCase()]}`);
  return num(s);
}

/** Дата 'dd.mm.yyyy' или 'dd.mm.yyyy_hh:mm:ss' → ISO-строка */
function parseRuDateTime(s: string): string | null {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:[_ ](\d{2}):(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const t = m[4] ? `${m[4]}:${m[5]}:${m[6]}` : '00:00:00';
  return `${m[3]}-${m[2]}-${m[1]}T${t}`;
}

// ---------- запись ----------

/** Вставка пачками по 500 строк: ON CONFLICT обновляет существующие строки */
async function upsert(
  client: PoolClient,
  table: string,
  cols: string[],
  rows: unknown[][],
  conflict: string,
  update: string[]
) {
  if (!rows.length) return 0;
  const CH = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += CH) {
    const chunk = rows.slice(i, i + CH);
    const params: unknown[] = [];
    const values = chunk
      .map(
        (r) =>
          '(' +
          r
            .map((v) => {
              params.push(v);
              return `$${params.length}`;
            })
            .join(',') +
          ')'
      )
      .join(',');
    // элемент вида 'col = expr' задаёт выражение целиком, иначе берётся значение из EXCLUDED
    const sets = update.map((c) => (c.includes('=') ? c : `${c} = EXCLUDED.${c}`)).join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES ${values}
                 ON CONFLICT (${conflict}) ${update.length ? `DO UPDATE SET ${sets}` : 'DO NOTHING'}`;
    await client.query(sql, params);
    written += chunk.length;
  }
  return written;
}

/** Обеспечивает календарь для дат из файла (внешний ключ) */
async function ensureCalendar(client: PoolClient, rows: unknown[][]) {
  const unique = new Map<string, unknown[]>();
  for (const r of rows) unique.set(String(r[0]), r);
  return upsert(
    client,
    'azs.calendar',
    [
      'cal_date',
      'day_of_week',
      'week_of_year',
      'month',
      'quarter',
      'year',
      'season',
      'is_weekend',
      'is_holiday',
      'holiday_name',
    ],
    [...unique.values()],
    'cal_date',
    []
  );
}

async function knownStations(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query(`SELECT station_code FROM azs.station`);
  return new Set(rows.map((r) => String(r.station_code).trim()));
}

// ---------- типы файлов ----------

/** Справочник АЗС: код станции — последние три цифры названия (как в transform.sql) */
async function importStations(
  client: PoolClient,
  records: Record<string, string>[],
  res: ImportResult
) {
  const bool = (v?: string) => v === '1';
  const rows: unknown[][] = [];
  for (const r of records) {
    const name = (r['station_name'] || '').trim();
    const code = stCode(name);
    if (!code || !r['road_type']) {
      res.skipped++;
      continue;
    }
    rows.push([
      code,
      name,
      r['station_id'] || null,
      r['road_type'] || null,
      num(r['road_level'])?.toString() ?? null,
      r['direction'] || null,
      num(r['settlement_size']),
      num(r['distance_to_city_km']),
      num(r['total_pumps']),
      bool(r['has_shop']),
      num(r['shop_area_m2']),
      bool(r['has_car_wash']),
      bool(r['has_tire_service']),
      bool(r['has_cafe']),
      bool(r['has_hotel']),
    ]);
  }
  res.tables.station = await upsert(
    client,
    'azs.station',
    [
      'station_code',
      'station_name',
      'station_ext_id',
      'road_type',
      'road_level',
      'direction',
      'settlement_size',
      'distance_to_city_km',
      'total_pumps',
      'has_shop',
      'shop_area_m2',
      'has_car_wash',
      'has_tire_service',
      'has_cafe',
      'has_hotel',
    ],
    rows,
    'station_code',
    [
      'station_name',
      'station_ext_id',
      'road_type',
      'road_level',
      'direction',
      'settlement_size',
      'distance_to_city_km',
      'total_pumps',
      'has_shop',
      'shop_area_m2',
      'has_car_wash',
      'has_tire_service',
      'has_cafe',
      'has_hotel',
    ]
  );
  res.written += rows.length;
  res.rows = records.length;
}

async function importPrices(
  client: PoolClient,
  records: Record<string, string>[],
  headers: string[],
  res: ImportResult
) {
  const stations = await knownStations(client);
  const fuels = (await client.query(`SELECT fuel_code FROM azs.fuel_type`)).rows.map(
    (r) => r.fuel_code as string
  );
  const cal: unknown[][] = [];
  const fuelRows: unknown[][] = [];
  const dayCols = fuels.filter(
    (f) => headers.includes(`sales_${f}`) && headers.includes(`price_${f}`)
  );
  for (const r of records) {
    const code = stCode(r['Название АЗС']);
    const date = (r['Временная метка'] || '').slice(0, 10);
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.skipped++;
      continue;
    }
    if (!stations.has(code)) {
      res.skipped++;
      if (!res.unknownStations.includes(code)) res.unknownStations.push(code);
      continue;
    }
    cal.push(
      calendarRow(date, {
        season: r['season'] || undefined,
        isWeekend: r['is_weekend'] === '1' ? true : undefined,
        isHoliday: r['is_holiday'] === '1' ? true : undefined,
        holidayName: r['holiday_name'] || null,
      })
    );
    for (const f of dayCols) {
      const price = num(r[`price_${f}`]);
      const vol = num(r[`sales_${f}`]);
      const offered = price !== null && price > 0;
      fuelRows.push([code, date, f, vol ?? 0, offered ? price : null, offered, false, null]);
    }
  }
  res.tables.calendar = await ensureCalendar(client, cal);
  res.tables.fuel_daily = await upsert(
    client,
    'azs.fuel_daily',
    [
      'station_code',
      'sale_date',
      'fuel_code',
      'sales_volume',
      'price',
      'is_offered',
      'price_filled',
      'price_fill_method',
    ],
    fuelRows,
    'station_code, sale_date, fuel_code',
    [
      'sales_volume',
      // строки, заполненные пайплайном (price_filled), не перезаписываем
      'price = CASE WHEN azs.fuel_daily.price_filled THEN azs.fuel_daily.price ELSE EXCLUDED.price END',
      'is_offered = CASE WHEN azs.fuel_daily.price_filled THEN azs.fuel_daily.is_offered ELSE EXCLUDED.is_offered END',
    ]
  );
  res.written = res.tables.fuel_daily;
  res.rows = records.length * dayCols.length;
}

async function importTraffic(
  client: PoolClient,
  records: Record<string, string>[],
  res: ImportResult
) {
  const stations = await knownStations(client);
  const map: [string, string][] = [
    ['traffic_Passengers_cars', 'cars'],
    ['traffic_Transporter', 'transporters'],
    ['traffic_Truck', 'trucks'],
    ['traffic_Truck_long', 'trucks_long'],
    ['traffic_Truck_short', 'trucks_short'],
    ['traffic_Undefined', 'undefined'],
    ['traffic_intensiv_fiz', 'intensity_physical'],
    ['traffic_intensiv_priv', 'intensity_private'],
    ['traffic_plotnost', 'density'],
    ['traffic_scorost', 'speed'],
  ];
  const cal: unknown[][] = [],
    out: unknown[][] = [];
  for (const r of records) {
    const code = stCode(r['Название АЗС']);
    const date = (r['Дата'] || '').slice(0, 10);
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.skipped++;
      continue;
    }
    if (!stations.has(code)) {
      res.skipped++;
      if (!res.unknownStations.includes(code)) res.unknownStations.push(code);
      continue;
    }
    cal.push(calendarRow(date));
    out.push([code, date, ...map.map(([src]) => num(r[src])), r['traffic_uroven_jbslugi'] || null]);
  }
  res.rows = records.length;
  res.tables.calendar = await ensureCalendar(client, cal);
  res.tables.traffic_daily = await upsert(
    client,
    'azs.traffic_daily',
    ['station_code', 'traffic_date', ...map.map(([, d]) => d), 'service_level'],
    out,
    'station_code, traffic_date',
    [...map.map(([, d]) => d), 'service_level']
  );
  res.written = res.tables.traffic_daily;
}

async function importWeather(
  client: PoolClient,
  records: Record<string, string>[],
  res: ImportResult
) {
  const stations = await knownStations(client);
  const cal: unknown[][] = [],
    out: unknown[][] = [];
  for (const r of records) {
    const code = stCode(r['station_name']);
    const date = (r['date'] || '').slice(0, 10);
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.skipped++;
      continue;
    }
    if (!stations.has(code)) {
      res.skipped++;
      if (!res.unknownStations.includes(code)) res.unknownStations.push(code);
      continue;
    }
    cal.push(calendarRow(date));
    const hum = num(r['humidity_%']);
    out.push([
      code,
      date,
      num(r['temperature_C']),
      hum === null ? null : Math.round(hum),
      num(r['pressure_hPa']),
      num(r['wind_speed_ms']),
      num(r['precipitation_mm']),
      r['weather_type'] || null,
    ]);
  }
  res.rows = records.length;
  res.tables.calendar = await ensureCalendar(client, cal);
  res.tables.weather_daily = await upsert(
    client,
    'azs.weather_daily',
    [
      'station_code',
      'weather_date',
      'temperature_c',
      'humidity_pct',
      'pressure_hpa',
      'wind_speed_ms',
      'precipitation_mm',
      'weather_type',
    ],
    out,
    'station_code, weather_date',
    [
      'temperature_c',
      'humidity_pct',
      'pressure_hpa',
      'wind_speed_ms',
      'precipitation_mm',
      'weather_type',
    ]
  );
  res.written = res.tables.weather_daily;
}

/** Цены конкурентов: записи идут по позициям, как в load_competitor_prices.py */
async function importCompetitors(client: PoolClient, buffer: Buffer, res: ImportResult) {
  const stations = await knownStations(client);
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const delim = ';';
  const rows = parseCsv(text, delim).slice(1);
  res.rows = rows.length;
  const comp = new Map<string, number>();
  const cal: unknown[][] = [],
    cpRows: unknown[][] = [];
  const compRows: unknown[][] = [];
  for (const r of rows) {
    const [, variable, , stationId, , ts, value, brand, number] = r.map((v) => (v ?? '').trim());
    const code = stCode(stationId);
    if (!code || !stations.has(code)) {
      res.skipped++;
      if (code && !res.unknownStations.includes(code)) res.unknownStations.push(code);
      continue;
    }
    const observed = parseRuDateTime(ts);
    if (!observed || !brand) {
      res.skipped++;
      continue;
    }
    const price = parsePrice(value);
    const offered = price !== null && price > 0;
    const isBrand = /brend/i.test(variable);
    const fuel = variable.replace(/^competitor_price_/, '').replace(/_?brend$/i, '');
    const key = `${code}|${brand}|${number}`;
    if (!comp.has(key)) {
      comp.set(key, -1);
      compRows.push([code, brand, number]);
    }
    cal.push(calendarRow(observed.slice(0, 10)));
    cpRows.push([null, key, fuel, isBrand, observed, offered ? price : null, offered]);
  }
  res.tables.calendar = await ensureCalendar(client, cal);
  // конкуренты
  const uniqComp = [...new Set(compRows.map((r) => JSON.stringify(r)))].map(
    (s) => JSON.parse(s) as string[]
  );
  await upsert(
    client,
    'azs.competitor',
    ['station_code', 'brand', 'brand_no'],
    uniqComp,
    'station_code, brand, brand_no',
    []
  );
  res.tables.competitor = uniqComp.length;
  const ids = new Map<string, number>();
  const { rows: idRows } = await client.query(
    `SELECT competitor_id, station_code, brand, brand_no FROM azs.competitor`
  );
  for (const r of idRows)
    ids.set(`${String(r.station_code).trim()}|${r.brand}|${r.brand_no}`, r.competitor_id);
  // номер строки: у уже известного наблюдения (конкурент, топливо, время, признак) берём существующий,
  // новым выдаём номера выше текущего максимума — так повторная загрузка не перезаписывает чужие строки
  const { rows: existing } = await client.query(
    `SELECT source_row_no, competitor_id, fuel_code, is_brand_price, observed_at::text AS obs FROM azs.competitor_price`
  );
  const keyOf = (cid: number, fuel: string, brand: boolean, obs: string) =>
    `${cid}|${fuel}|${brand}|${obs.replace(' ', 'T').slice(0, 19)}`;
  const known = new Map<string, number>();
  let maxNo = 0;
  for (const r of existing) {
    known.set(keyOf(r.competitor_id, r.fuel_code, r.is_brand_price, r.obs), r.source_row_no);
    if (r.source_row_no > maxNo) maxNo = r.source_row_no;
  }
  const finalRows: unknown[][] = [];
  for (const r of cpRows) {
    const cid = ids.get(r[1] as string);
    if (!cid) continue;
    const k = keyOf(cid, r[2] as string, r[3] as boolean, r[4] as string);
    let no = known.get(k);
    if (no === undefined) {
      no = ++maxNo;
      known.set(k, no);
    }
    finalRows.push([no, cid, r[2], r[3], r[4], r[5], r[6]]);
  }
  res.tables.competitor_price = await upsert(
    client,
    'azs.competitor_price',
    [
      'source_row_no',
      'competitor_id',
      'fuel_code',
      'is_brand_price',
      'observed_at',
      'price',
      'is_offered',
    ],
    finalRows,
    'source_row_no',
    ['competitor_id', 'fuel_code', 'is_brand_price', 'observed_at', 'price', 'is_offered']
  );
  res.written = res.tables.competitor_price;
}

async function importShop(client: PoolClient, buffer: Buffer, res: ImportResult) {
  const stations = await knownStations(client);
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const [headers, ...body] = parseCsv(text, ';');
  const hs = headers.map((h) => h.trim());
  const dateCols = hs.map((h, i) => ({ h, i })).filter((x) => /^\d{2}\.\d{2}\.\d{4}$/.test(x.h));
  const iProd = hs.indexOf('Переменная'),
    iStation = hs.indexOf('АЗС'),
    iGroup = hs.indexOf('Наименование групп');
  const products = new Map<string, string>();
  const cal: unknown[][] = [],
    out: unknown[][] = [];
  res.rows = body.length * dateCols.length;
  for (const r of body) {
    const code = stCode(r[iStation]);
    const product = (r[iProd] || '').trim();
    if (!code || !product || !stations.has(code)) {
      res.skipped += dateCols.length;
      if (code && !res.unknownStations.includes(code)) res.unknownStations.push(code);
      continue;
    }
    products.set(product, (r[iGroup] || '').trim() || 'Продажи сопутствующих товаров');
    for (const { h, i } of dateCols) {
      const [dd, mm, yyyy] = h.split('.');
      const iso = `${yyyy}-${mm}-${dd}`;
      const v = num(r[i]);
      if (v === null) {
        res.skipped++;
        continue;
      }
      cal.push(calendarRow(iso));
      out.push([code, product, iso, v]);
    }
  }
  res.tables.calendar = await ensureCalendar(client, cal);
  res.tables.shop_product = await upsert(
    client,
    'azs.shop_product',
    ['product_code', 'group_name'],
    [...products.entries()],
    'product_code',
    ['group_name']
  );
  res.tables.shop_sales_daily = await upsert(
    client,
    'azs.shop_sales_daily',
    ['station_code', 'product_code', 'sale_date', 'revenue_rub'],
    out,
    'station_code, product_code, sale_date',
    ['revenue_rub']
  );
  res.written = res.tables.shop_sales_daily;
}

async function importPromotions(
  client: PoolClient,
  records: Record<string, string>[],
  res: ImportResult
) {
  const out: unknown[][] = [];
  for (const r of records) {
    const no = num(r['№п/п']);
    if (no === null || !r['Акция']) {
      res.skipped++;
      continue;
    }
    const start = r['Дата начала'] || null,
      end = r['Дата конца'] || null;
    const validity = r['Срок действия'] || (!start ? 'неизвестно' : !end ? 'бессрочно' : 'по дате');
    out.push([
      Math.round(no),
      r['ВИНК'] || null,
      r['Акция'],
      start,
      end,
      num(r['Продолжительность (дней)']) === null
        ? null
        : Math.round(num(r['Продолжительность (дней)']) as number),
      r['Категория'] || '—',
      r['Охват (нормализованный)'] || '—',
      r['Описание'] || null,
      validity,
    ]);
  }
  res.rows = records.length;
  res.tables.promotion = await upsert(
    client,
    'azs.promotion',
    [
      'source_no',
      'company',
      'name',
      'start_date',
      'end_date',
      'duration_days',
      'category',
      'coverage',
      'description',
      'validity',
    ],
    out,
    'source_no',
    [
      'company',
      'name',
      'start_date',
      'end_date',
      'duration_days',
      'category',
      'coverage',
      'description',
      'validity',
    ]
  );
  res.written = res.tables.promotion;
}

/** Главная функция: определяет тип, пишет в одной транзакции, журналирует загрузку */
export async function importCsv(
  fileName: string,
  buffer: Buffer,
  userId: string | null,
  opts: { recalc?: boolean } = {}
): Promise<ImportResult> {
  const { headers, records } = readCsv(buffer);
  const type = detectType(headers);
  const pool = getPool();
  if (!type)
    throw Object.assign(new Error('Тип файла не распознан по заголовкам'), { status: 400 });

  const res: ImportResult = {
    fileName,
    type,
    rows: 0,
    written: 0,
    skipped: 0,
    unknownStations: [],
    tables: {},
  };
  const started = Date.now();
  logger.info('Импорт начат', 'IMPORT', { fileName, type, userId, bytes: buffer.length });

  // Резервная копия схемы azs до записи: без неё загрузка не выполняется
  const backupFile = await createBackup(`before_import_${type}`, 'azs');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (type === 'stations') await importStations(client, records, res);
    else if (type === 'prices') await importPrices(client, records, headers, res);
    else if (type === 'traffic') await importTraffic(client, records, res);
    else if (type === 'weather') await importWeather(client, records, res);
    else if (type === 'competitors') await importCompetitors(client, buffer, res);
    else if (type === 'shop') await importShop(client, buffer, res);
    else if (type === 'promotions') await importPromotions(client, records, res);
    await client.query('COMMIT');
  } catch (e: any) {
    await client.query('ROLLBACK');
    logger.error('Импорт не выполнен, изменения откатаны', e, 'IMPORT', {
      fileName,
      type,
      userId,
      backupFile,
    });
    await pool
      .query(
        `INSERT INTO import_history (file_name, imported_by, import_type, record_count, status, error_message)
       VALUES ($1, $2, $3, 0, 'failed', $4)`,
        [fileName, userId, type, String(e.message)]
      )
      .catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
  await pool
    .query(
      `INSERT INTO import_history (file_name, imported_by, import_type, record_count, status)
     VALUES ($1, $2, $3, $4, 'completed')`,
      [fileName, userId, type, res.written]
    )
    .catch(() => undefined);
  logger.info('Импорт завершён', 'IMPORT', {
    fileName,
    type,
    userId,
    backupFile,
    rows: res.rows,
    written: res.written,
    skipped: res.skipped,
    unknownStations: res.unknownStations,
    tables: res.tables,
    durationMs: Date.now() - started,
  });
  // Данные изменились: кэши расчётов больше не верны
  clearRulesCache();
  clearElasticityCache();
  // Данные записаны и зафиксированы; ошибка пересчёта не отменяет импорт.
  // При загрузке пакета файлов пересчёт делает маршрут один раз в конце (recalc: false)
  if (opts.recalc !== false) {
    try {
      res.recommendations = await generateRecommendations();
      logger.info('Рекомендации пересчитаны после импорта', 'IMPORT', {
        fileName,
        ...res.recommendations,
      });
    } catch (e: any) {
      res.recommendations = { error: String(e.message) };
      logger.error('Пересчёт рекомендаций после импорта не выполнен', e, 'IMPORT', { fileName });
    }
  }
  return res;
}
