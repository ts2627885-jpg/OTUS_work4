/**
 * Генерация и сохранение рекомендаций по AI_Agent_Rules.
 * Вызывается из POST /api/recommendations/generate и в конце импорта CSV.
 */
import { getPool } from '@config/database';
import { computeRulesCached } from '@services/rules.service';

export interface GenerateResult {
  asOfDate: string;
  saved: number;
  closed: number;
}

/** Пересчитывает правила, обновляет активные рекомендации и закрывает устаревшие */
export async function generateRecommendations(): Promise<GenerateResult> {
  // Через кэш: пересчёт рекомендаций после импорта заполняет кэш, и первый запрос правил уже быстрый
  const analysis = await computeRulesCached();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: stations } = await client.query(`SELECT id, name FROM public.azs`);
    const byName = new Map<string, string>(stations.map((s: any) => [s.name, s.id]));
    let saved = 0;
    const keys: string[] = [];
    for (const r of analysis.recommendations) {
      const azsId = r.station === 'Вся сеть' ? null : (byName.get(r.station) ?? null);
      if (r.station !== 'Вся сеть' && !azsId) continue;
      keys.push(r.id);
      await client.query(
        `INSERT INTO recommendations (azs_id, type, rule_id, fuel_type, title, priority, action, effect, reason,
                                      status, dedupe_key, current_price, recommended_price)
         VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, 'active', $9, NULL, NULL)
         ON CONFLICT (dedupe_key) DO UPDATE SET
           priority = EXCLUDED.priority, title = EXCLUDED.title, action = EXCLUDED.action,
           effect = EXCLUDED.effect, reason = EXCLUDED.reason, created_at = now()
         WHERE recommendations.status = 'active'`,
        [azsId, r.rule, r.fuel, r.title, r.priority, r.action, r.effect, r.reason, r.id]
      );
      saved++;
    }
    // Активные рекомендации, которых больше нет в расчёте, закрываются автоматически
    const stale = await client.query(
      `UPDATE recommendations SET status = 'rejected', action = 'Условие больше не выполняется', completed_at = now()
        WHERE status = 'active' AND dedupe_key IS NOT NULL AND NOT (dedupe_key = ANY($1))`,
      [keys]
    );
    await client.query('COMMIT');
    return { asOfDate: analysis.asOfDate, saved, closed: stale.rowCount ?? 0 };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
