import { recommendationsAPI } from '@/api/recommendations'
import { useRequest, useMutation } from '@/composables/useRequest'

/**
 * Рекомендации: список, пересчёт, закрытие, сверка станций и правила расчёта.
 *
 * const { items, loading, error, load, generate, complete, ... } = useRecommendations()
 */
export function useRecommendations() {
  const list = useRequest((filters) => recommendationsAPI.list(filters).then(r => r.data.data), [])
  const rules = useRequest(() => recommendationsAPI.rules().then(r => r.data.data), null)
  const stationCheckState = useRequest(() => recommendationsAPI.stationCheck().then(r => r.data.data), null)
  const generateState = useMutation(() => recommendationsAPI.generate().then(r => r.data.data))
  const completeState = useMutation((id) => recommendationsAPI.complete(id).then(r => r.data.data))

  // Последние фильтры запоминаем: после пересчёта и закрытия список перезагружается с теми же фильтрами
  let lastFilters = undefined
  const load = (filters) => {
    lastFilters = filters
    return list.run(filters)
  }

  // Пересчёт сохраняет рекомендации и обновляет список
  const generate = async () => {
    const result = await generateState.run()
    await load(lastFilters)
    return result
  }

  const complete = async (id) => {
    await completeState.run(id)
    await load(lastFilters)
  }

  return {
    items: list.data,
    loading: list.loading,
    error: list.error,
    load,
    generate,
    complete,
    rules: rules.data,
    loadRules: rules.run,
    stationCheck: stationCheckState.data,
    stationCheckError: stationCheckState.error,
    checkStations: stationCheckState.run,
    checkingStations: stationCheckState.loading,
    generateState,
    completeState,
  }
}
