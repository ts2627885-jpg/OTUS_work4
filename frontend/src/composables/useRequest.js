import { ref } from 'vue'

/**
 * Текст ошибки для пользователя.
 * - Ошибка валидации (400) и другие ответы с текстом сервера показываем как есть.
 * - Сетевые ошибки, таймаут и коды 401 / 403 / 404 / 5xx переводим в понятные сообщения.
 */
export const errorMessage = (e) => {
  if (!e) return 'Неизвестная ошибка'
  const status = e.response?.status
  if (!e.response) {
    // Нет ответа: сеть недоступна, сервер выключен или запрос не успел выполниться
    if (e.code === 'ECONNABORTED' || /timeout/i.test(e.message || '')) {
      return 'Сервер не ответил вовремя. Попробуйте ещё раз.'
    }
    return 'Нет связи с сервером. Проверьте подключение или попробуйте позже.'
  }
  if (status === 401) return 'Сессия истекла. Войдите снова.'
  if (status === 403) return e.response.data?.error || 'Недостаточно прав для этого действия.'
  if (status === 404) return e.response.data?.error || 'Данные не найдены.'
  if (status >= 500) return 'Внутренняя ошибка сервера. Попробуйте позже.'
  return e.response.data?.error || e.message || 'Неизвестная ошибка'
}

/**
 * Запрос с состоянием загрузки и ошибки.
 *
 * const { data, loading, error, run } = useRequest((params) => client.get('/x', { params }).then(r => r.data.data))
 * await run({ days: 28 })   // data.value = результат, error.value = текст ошибки, возвращает результат или null
 */
export function useRequest(request, initial = null) {
  const data = ref(initial)
  const loading = ref(false)
  const error = ref('')

  async function run(...args) {
    loading.value = true
    error.value = ''
    try {
      const result = await request(...args)
      data.value = result
      return result
    } catch (e) {
      error.value = errorMessage(e)
      return null
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, run }
}

/**
 * Отправка данных на сервер (POST / PUT / DELETE) с состоянием отправки и ошибки.
 * В отличие от useRequest, ошибка пробрасывается наружу: форма сама решает, что показать.
 *
 * const { loading, error, run } = useMutation((body) => client.post('/x', body).then(r => r.data.data))
 * const created = await run({ name: 'АЗС' })   // результат, при ошибке — исключение (error.value уже заполнен)
 */
export function useMutation(request) {
  const loading = ref(false)
  const error = ref('')

  async function run(...args) {
    loading.value = true
    error.value = ''
    try {
      return await request(...args)
    } catch (e) {
      error.value = errorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, run }
}
