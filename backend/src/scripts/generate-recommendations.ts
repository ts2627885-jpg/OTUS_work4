/**
 * Пересчёт рекомендаций по всем АЗС из public.azs.
 * Запускается пайплайном после синхронизации станций (run_pipeline.sh, шаг 4c),
 * чтобы рекомендации для новых АЗС появлялись в пульте автоматически.
 *
 * Запуск вручную: npx ts-node -r tsconfig-paths/register src/scripts/generate-recommendations.ts
 */
import { getRawPool, closeDatabasePool } from '@config/database';
import { requestScope } from '@config/request-context';
import { generateRecommendations } from '@services/recommendations.service';

/**
 * Системная задача работает вне запроса, поэтому под RLS ей нужен явный контекст.
 * Пересчёт идёт от роли admin (полный доступ ко всем станциям).
 */
async function runAsAdmin<T>(task: () => Promise<T>): Promise<T> {
  const client = await getRawPool().connect();
  try {
    await client.query(
      "SELECT set_config('app.role', 'admin', false), set_config('app.user_id', '', false)"
    );
    return await requestScope.run({ client }, task);
  } finally {
    // Контекст не должен остаться в соединении, которое вернётся в пул
    await client.query('RESET app.role; RESET app.user_id').catch(() => undefined);
    client.release();
  }
}

async function main(): Promise<void> {
  const result = await runAsAdmin(() => generateRecommendations());
  console.log(
    `Рекомендации пересчитаны: на дату ${result.asOfDate}, сохранено ${result.saved}, закрыто устаревших ${result.closed}`
  );
  await closeDatabasePool(getRawPool());
}

main().catch(async (error) => {
  console.error('Ошибка пересчёта рекомендаций:', error);
  await closeDatabasePool(getRawPool());
  process.exit(1);
});
