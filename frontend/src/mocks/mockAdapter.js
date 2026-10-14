// Мок-адаптер axios: отвечает данными из fixtures/responses.json без backend и БД.
// Включается при VITE_USE_MOCKS=true (npm run dev:mock). Фикстуры — реальные ответы API,
// снятые с базы azs_pult (станции 121–125), поэтому форма ответов совпадает с backend.
// Записи (POST/PUT/DELETE) не меняют данные: возвращают успешный ответ-заглушку.
import responses from './fixtures/responses.json'

const EMPTY = { success: true, data: [] }
const WRITE_OK = { success: true, data: null, mock: true }

const respond = (config, data, status = 200) =>
  Promise.resolve({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  })

export default function mockAdapter(config) {
  const method = (config.method || 'get').toUpperCase()
  const path = String(config.url || '').split('?')[0]

  if (method === 'POST' && path === '/auth/login') {
    return respond(config, responses['POST /auth/login'])
  }
  if (method !== 'GET') {
    console.info(`[mock] ${method} ${path} — запись не сохраняется`)
    return respond(config, WRITE_OK)
  }

  const azsId = config.params?.azsId
  const key = azsId ? `${path}?azsId=${azsId}` : path
  if (key in responses) return respond(config, responses[key])
  if (path in responses) return respond(config, responses[path])

  console.warn(`[mock] нет фикстуры для GET ${key}, отдаю пустой ответ`)
  return respond(config, EMPTY)
}
