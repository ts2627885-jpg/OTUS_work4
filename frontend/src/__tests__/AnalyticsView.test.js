import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/api/azs', () => ({ azsAPI: { getAll: vi.fn() } }))
vi.mock('@/components/charts/SeriesChart.vue', () => ({ default: { render: () => null } }))

import client from '@/api/client'
import { azsAPI } from '@/api/azs'
import AnalyticsView from '@/views/AnalyticsView.vue'

const section = (title) => ({ title, rows: [], note: null })

const mountView = () => mount(AnalyticsView, { global: { plugins: [] } })
const tabButton = (wrapper, text) => wrapper.findAll('button.tab').find((b) => b.text() === text)

describe('AnalyticsView (аналитика)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    azsAPI.getAll.mockResolvedValue({ data: { data: [{ id: 'id-121', name: 'АЗС 121' }] } })
  })

  it('загружает вкладку «Ценовая политика» и выводит разделы из ответа', async () => {
    client.get.mockResolvedValue({
      data: { data: { asOf: '2026-09-21', sections: [section('Симулятор цены'), section('Текущие цены')] } }
    })

    const wrapper = mountView()
    await flushPromises()

    expect(client.get).toHaveBeenCalledWith('/analytics/prices', expect.any(Object))
    expect(wrapper.text()).toContain('Симулятор цены')
    expect(wrapper.text()).toContain('Текущие цены')
  })

  it('переключение вкладки запрашивает данные этой вкладки', async () => {
    client.get.mockResolvedValue({ data: { data: { asOf: '2026-09-21', sections: [] } } })

    const wrapper = mountView()
    await flushPromises()
    await tabButton(wrapper, 'Трафик').trigger('click')
    await flushPromises()

    expect(client.get).toHaveBeenLastCalledWith('/analytics/traffic', expect.any(Object))
  })

  it('при ошибке сервера показывает сообщение и не падает', async () => {
    client.get.mockRejectedValue({ response: { data: { error: 'Расчёт временно недоступен' } } })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Расчёт временно недоступен')
  })

  it('для вкладки по станции запрос содержит azsId выбранной станции', async () => {
    client.get.mockResolvedValue({ data: { data: { asOf: '2026-09-21', sections: [] } } })

    const wrapper = mountView()
    await flushPromises()
    await tabButton(wrapper, 'Конкуренты').trigger('click')
    await flushPromises()

    const select = wrapper.find('select')
    await select.setValue('id-121')
    await flushPromises()

    const [url, config] = client.get.mock.calls.at(-1)
    expect(url).toBe('/analytics/competitors')
    expect(config.params.azsId).toBe('id-121')
  })
})
