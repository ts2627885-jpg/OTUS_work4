import { describe, it, expect, vi, afterEach } from 'vitest'
import mockAdapter from '@/mocks/mockAdapter'

const call = (config) => mockAdapter({ method: 'get', url: '', params: {}, ...config })

describe('mockAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('отдаёт список из 5 АЗС 121–125 из фикстур', async () => {
    const res = await call({ url: '/azs' })

    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.data.map((s) => s.name)).toEqual(['АЗС 121', 'АЗС 122', 'АЗС 123', 'АЗС 124', 'АЗС 125'])
  })

  it('отвечает токеном на вход администратора', async () => {
    const res = await mockAdapter({ method: 'post', url: '/auth/login', data: { username: 'admin', password: 'x' } })

    expect(res.data.data.token.access_token).toBeTruthy()
    expect(res.data.data.user.username).toBe('admin')
  })

  it('на неизвестный путь возвращает пустой успешный ответ и предупреждение', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await call({ url: '/no/such/endpoint' })

    expect(res.data).toEqual({ success: true, data: [] })
    expect(warn).toHaveBeenCalled()
  })

  it('записи (POST/PUT/DELETE) не падают и помечаются как моки', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    const res = await mockAdapter({ method: 'put', url: '/azs/1', data: {} })

    expect(res.data.mock).toBe(true)
    expect(info).toHaveBeenCalled()
  })
})
