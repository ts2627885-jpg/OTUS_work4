import { azsAPI } from '@/api/azs'
import { useRequest, useMutation } from '@/composables/useRequest'

/**
 * Станции: загрузка списка и отправка изменений (создание, изменение, удаление).
 *
 * const { stations, loading, error, load, create, update, remove } = useStations()
 * await load()                       // stations.value — массив станций, error.value — текст ошибки
 * const s = await create({...})      // бросает исключение при ошибке, error формы — в createState.error
 */
export function useStations() {
  const list = useRequest(() => azsAPI.getAll().then(r => r.data.data), [])
  const createState = useMutation((body) => azsAPI.create(body).then(r => r.data.data))
  const updateState = useMutation((id, body) => azsAPI.update(id, body).then(r => r.data.data))
  const removeState = useMutation((id) => azsAPI.delete(id))

  const load = () => list.run()

  const create = async (body) => {
    const created = await createState.run(body)
    await load()
    return created
  }

  const update = async (id, body) => {
    const updated = await updateState.run(id, body)
    await load()
    return updated
  }

  const remove = async (id) => {
    await removeState.run(id)
    await load()
  }

  return {
    stations: list.data,
    loading: list.loading,
    error: list.error,
    load,
    create,
    update,
    remove,
    createState,
    updateState,
    removeState,
  }
}
