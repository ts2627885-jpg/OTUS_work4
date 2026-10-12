/**
 * Пересчёт рекомендаций по всем АЗС из public.azs.
 * Запускается пайплайном после синхронизации станций (run_pipeline.sh, шаг 4c),
 * чтобы рекомендации для новых АЗС появлялись в пульте автоматически.
 *
 * Запуск вручную: npx ts-node -r tsconfig-paths/register src/scripts/generate-recommendations.ts
 */
import { getPool, closeDatabasePool } from '@config/database';
import { generateRecommendations } from '@services/recommendations.service';

async function main(): Promise<void> {
  const result = await generateRecommendations();
  console.log(`Рекомендации пересчитаны: на дату ${result.asOfDate}, сохранено ${result.saved}, закрыто устаревших ${result.closed}`);
  await closeDatabasePool(getPool());
}

main().catch(async (error) => {
  console.error('Ошибка пересчёта рекомендаций:', error);
  await closeDatabasePool(getPool());
  process.exit(1);
});
