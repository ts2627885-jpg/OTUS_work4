import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

import client from '@/api/client'
import RecommendationsView from '@/views/RecommendationsView.vue'
import { useAuthStore } from '@/stores/auth'

const recommendation = {
  id: 'rec-1',
  title: 'Выравнивание цены с рынком',
  priority: 'URGENT',
  status: 'active',
  rule: 'PRICE-001',
  station: 'АЗС 121',
  fuel: 'AI95',
  action: 'Ориентир 71,45 ₽/л',
  effect: 'не рассчитан: нет продаж',
  reason: 'тест'
}

const analysis = {
  asOfDate: '2026-09-21',
  windows: { competitorDays: 14, elasticityDays: 365, r2Min: 0.36 },
  notComputed: []
}

// Ответы по адресам API: список рекомендаций и правила расчёта
const respondTo = ({ recs, rules }) => {
  client.get.mockImplementation((url) => {
    if (url === '/recommendations') return recs
    if (url === '/analysis/rules') return rules
    return Promise.resolve({ data: { data: [] } })
  })
}

const mountView = () => mount(RecommendationsView, { global: { plugins: [] } })

describe('RecommendationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    // роль администратора: доступна кнопка «Сформировать»
    useAuthStore().user = { username: 'admin', role: 'admin', permissions: ['*'] }
  })

  it('показывает рекомендации и станцию из ответа API', async () => {
    respondTo({
      recs: Promise.resolve({ data: { data: [recommendation] } }),
      rules: Promise.resolve({ data: { data: analysis } })
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Выравнивание цены с рынком')
    expect(wrapper.text()).toContain('АЗС 121')
    expect(wrapper.text()).toContain('Расчёт на 2026-09-21')
  })

  it('показывает понятную ошибку, если сервер не отвечает', async () => {
    respondTo({
      recs: Promise.reject({ response: { data: { error: 'Сервер недоступен' } } }),
      rules: Promise.resolve({ data: { data: analysis } })
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Сервер недоступен')
    expect(wrapper.text()).not.toContain('Выравнивание цены с рынком')
  })

  it('кнопка «Сформировать» сообщает, сколько рекомендаций сохранено', async () => {
    respondTo({
      recs: Promise.resolve({ data: { data: [] } }),
      rules: Promise.resolve({ data: { data: analysis } })
    })
    client.post.mockResolvedValue({ data: { data: { saved: 3, closed: 1 } } })

    const wrapper = mountView()
    await flushPromises()
    const generate = wrapper.findAll('button').find((b) => b.text() === 'Сформировать')
    await generate.trigger('click')
    await flushPromises()

    expect(client.post).toHaveBeenCalledWith('/recommendations/generate')
    expect(wrapper.text()).toContain('Сохранено рекомендаций: 3, закрыто автоматически: 1')
  })
})
