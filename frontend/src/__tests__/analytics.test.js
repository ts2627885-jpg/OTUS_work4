import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Номера счётчиков читаются при загрузке модуля, поэтому каждый тест загружает модуль заново
const loadAnalytics = async ({ metrika = '', ga = '' } = {}) => {
  vi.resetModules()
  vi.stubEnv('VITE_YANDEX_METRIKA_ID', metrika)
  vi.stubEnv('VITE_GOOGLE_ANALYTICS_ID', ga)
  return import('@/analytics')
}

// Вызовы из очереди window.ym: tag.js в тестах не загружается, видим то, что ушло бы в Метрику
const queuedCalls = () => (window.ym?.a || []).map((args) => Array.from(args))
// Команды gtag из dataLayer: gtag.js в тестах не загружается
const dataLayerCalls = () => (window.dataLayer || []).map((args) => Array.from(args))

const goalParams = () => queuedCalls().find((call) => call[1] === 'reachGoal')[3]

describe('аналитика (Яндекс.Метрика и Google Analytics)', () => {
  beforeEach(() => {
    delete window.ym
    delete window.dataLayer
    document.head.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('без номеров счётчиков ничего не подключает и не падает', async () => {
    const analytics = await loadAnalytics()

    analytics.initAnalytics()
    analytics.trackPageView('/azs')
    analytics.trackEvent('login_success', { role: 'admin' })

    expect(analytics.isAnalyticsEnabled()).toBe(false)
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeNull()
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull()
    expect(window.ym).toBeUndefined()
    expect(window.dataLayer).toBeUndefined()
  })

  describe('Яндекс.Метрика', () => {
    it('подключает tag.js один раз и инициализирует счётчик с отложенным первым просмотром', async () => {
      const analytics = await loadAnalytics({ metrika: '12345' })

      analytics.initAnalytics()
      analytics.initAnalytics()

      expect(
        document.querySelectorAll('script[src="https://mc.yandex.ru/metrika/tag.js"]')
      ).toHaveLength(1)
      const [init] = queuedCalls()
      expect(init.slice(0, 2)).toEqual([12345, 'init'])
      expect(init[2]).toMatchObject({ defer: true, ssl: true, webvisor: false })
    })

    it('отправляет просмотр страницы с полным адресом', async () => {
      const analytics = await loadAnalytics({ metrika: '12345' })

      analytics.trackPageView('/azs/42')

      expect(queuedCalls()).toContainEqual([12345, 'hit', `${window.location.origin}/azs/42`])
    })

    it('отправляет событие как цель с параметрами', async () => {
      const analytics = await loadAnalytics({ metrika: '12345' })

      analytics.trackEvent('login_success', { role: 'admin' })

      expect(queuedCalls()).toContainEqual([12345, 'reachGoal', 'login_success', { role: 'admin' }])
    })
  })

  describe('Google Analytics 4', () => {
    it('подключает gtag.js один раз и отключает автоматический просмотр', async () => {
      const analytics = await loadAnalytics({ ga: 'G-TEST123' })

      analytics.initAnalytics()
      analytics.initAnalytics()

      expect(
        document.querySelectorAll(
          'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]'
        )
      ).toHaveLength(1)
      const calls = dataLayerCalls()
      expect(calls[0][0]).toBe('js')
      expect(calls).toContainEqual(['config', 'G-TEST123', { send_page_view: false }])
    })

    it('отправляет просмотр страницы с адресом и путём', async () => {
      const analytics = await loadAnalytics({ ga: 'G-TEST123' })

      analytics.trackPageView('/azs/42')

      expect(dataLayerCalls()).toContainEqual([
        'event',
        'page_view',
        { page_location: `${window.location.origin}/azs/42`, page_path: '/azs/42' },
      ])
    })

    it('отправляет событие с параметрами', async () => {
      const analytics = await loadAnalytics({ ga: 'G-TEST123' })

      analytics.trackEvent('recommendations_generate', { saved: 3, closed: 1 })

      expect(dataLayerCalls()).toContainEqual([
        'event',
        'recommendations_generate',
        { saved: 3, closed: 1 },
      ])
    })
  })

  describe('общие правила отправки', () => {
    it('одно событие уходит в оба сервиса', async () => {
      const analytics = await loadAnalytics({ metrika: '12345', ga: 'G-TEST123' })

      analytics.trackEvent('logout')

      expect(queuedCalls()).toContainEqual([12345, 'reachGoal', 'logout', {}])
      expect(dataLayerCalls()).toContainEqual(['event', 'logout', {}])
    })

    it('не передаёт логин, пароль и токен ни в один сервис', async () => {
      const analytics = await loadAnalytics({ metrika: '12345', ga: 'G-TEST123' })

      analytics.trackEvent('login_failed', {
        username: 'admin',
        Password: 'secret',
        token: 'abc',
        reason: 'invalid_credentials',
      })

      expect(goalParams()).toEqual({ reason: 'invalid_credentials' })
      expect(dataLayerCalls()).toContainEqual([
        'event',
        'login_failed',
        { reason: 'invalid_credentials' },
      ])
    })

    it('обрезает длинные строки и пропускает пустые и составные значения', async () => {
      const analytics = await loadAnalytics({ metrika: '12345' })

      analytics.trackEvent('data_import_upload', {
        note: 'x'.repeat(200),
        files_count: 2,
        station_id: undefined,
        nested: { a: 1 },
      })

      expect(goalParams()).toEqual({ note: 'x'.repeat(100), files_count: 2 })
    })
  })
})
