/**
 * Настройки расчёта правил (FR-5.10): окна, пороги, надёжность модели.
 * Значения по умолчанию — из AI_Agent_Rules; изменённые сохраняются в app_settings.
 * Каждое изменение пишется в журнал аудита (до и после).
 */
import { Request } from 'express';
import { getPool } from '@config/database';
import { audit } from '@services/access.service';

export interface RuleSettings {
  price_window_days: number; // окно последней цены нашей АЗС, дней
  comp_window_days: number; // окно наблюдений конкурентов, дней
  elasticity_days: number; // окно регрессии эластичности, дней
  r2_min: number; // порог надёжности модели R²
  price_gap_min: number; // PRICE-001: разрыв с медианой, ₽ (порог срабатывания)
  price_gap_urgent: number; // PRICE-001: разрыв, с которого приоритет URGENT, ₽
  ab_step: number; // PRICE-004: шаг A/B-теста, ₽
  premium_drop_pct: number; // PRICE-002: падение объёма за 7 дней, % (отрицательное)
  traffic_slope_min: number; // TRAFFIC-002: рост трафика, ТС/день
  comp_drop_min: number; // COMP-001: снижение цены конкурента, ₽ (отрицательное)
  comp_reaction_min: number; // COMP-001: падение объёма, доля (отрицательная)
  promo_limit: number; // PROMO-003: акций за 30 дней, с которых приоритет HIGH
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  price_window_days: 30,
  comp_window_days: 14,
  elasticity_days: 365,
  r2_min: 0.36,
  price_gap_min: 0.5,
  price_gap_urgent: 1.5,
  ab_step: 0.5,
  premium_drop_pct: -5,
  traffic_slope_min: 0.5,
  comp_drop_min: -0.4,
  comp_reaction_min: -0.3,
  promo_limit: 2,
};

/** Допустимые диапазоны: защита от случайных значений */
const RANGES: Record<keyof RuleSettings, [number, number]> = {
  price_window_days: [1, 120],
  comp_window_days: [1, 60],
  elasticity_days: [30, 365],
  r2_min: [0, 1],
  price_gap_min: [0, 10],
  price_gap_urgent: [0, 20],
  ab_step: [0.01, 5],
  premium_drop_pct: [-100, 0],
  traffic_slope_min: [0, 1000],
  comp_drop_min: [-10, 0],
  comp_reaction_min: [-1, 0],
  promo_limit: [1, 50],
};

export async function getRuleSettings(): Promise<RuleSettings> {
  const { rows } = await getPool().query(`SELECT value FROM app_settings WHERE key = 'rules'`);
  return { ...DEFAULT_RULE_SETTINGS, ...(rows[0]?.value ?? {}) };
}

/** Проверяет и приводит значения к типам; неизвестные ключи отбрасываются */
export function validateRuleSettings(input: unknown): RuleSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Ожидается объект с настройками');
  const src = input as Record<string, unknown>;
  const out = { ...DEFAULT_RULE_SETTINGS };
  for (const key of Object.keys(RANGES) as (keyof RuleSettings)[]) {
    if (!(key in src)) continue;
    const v = Number(src[key]);
    const [min, max] = RANGES[key];
    if (!Number.isFinite(v) || v < min || v > max) {
      throw new Error(`${key}: значение должно быть от ${min} до ${max}`);
    }
    out[key] = v;
  }
  return out;
}

export async function saveRuleSettings(
  patch: unknown,
  userId: string | null,
  req: Request | null
): Promise<RuleSettings> {
  const before = await getRuleSettings();
  const after = validateRuleSettings({ ...before, ...(patch as object) });
  await getPool().query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('rules', $1, now(), $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify(after), userId]
  );
  const changed = (Object.keys(after) as (keyof RuleSettings)[]).filter(
    (k) => before[k] !== after[k]
  );
  await audit(req, userId, 'settings.update', 'app_settings', null, {
    changed: changed.map((k) => ({ key: k, from: before[k], to: after[k] })),
  });
  return after;
}
