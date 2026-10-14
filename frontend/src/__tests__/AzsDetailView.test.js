import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'id-121' } }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/api/azs', () => ({
  azsAPI: {
    getById: vi.fn(),
    update: vi.fn(),
    getSales: vi.fn(),
    getTraffic: vi.fn(),
    getWeather: vi.fn(),
    getCompetitors: vi.fn(),
  },
}))
// график не нужен для проверки текста; заменяем на пустой компонент
vi.mock('@/components/charts/SeriesChart.vue', () => ({
  default: { render: () => null },
}))

import client from '@/api/client'
import { azsAPI } from '@/api/azs'
import AzsDetailView from '@/views/AzsDetailView.vue'
import { useAuthStore } from '@/stores/auth'

const station = {
  id: 'id-121',
  name: 'АЗС 121',
  address: 'Федеральная трасса',
  region: 'Tver region',
  manager: null,
  status: 'active',
  fuelTypes: ['A92', 'DT'],
  latitude: null,
  longitude: null,
}

// успешные ответы по всем вкладкам карточки
const respondOk = () => {
  azsAPI.getById.mockResolvedValue({ data: { data: station } })
  azsAPI.getSales.mockResolvedValue({ data: { data: [] } })
  azsAPI.getTraffic.mockResolvedValue({ data: { data: [] } })
  azsAPI.getWeather.mockResolvedValue({ data: { data: [] } })
  azsAPI.getCompetitors.mockResolvedValue({ data: { data: [] } })
  client.get.mockImplementation((url) => {
    if (url === '/prices') {
      return Promise.resolve({
        data: {
          data: [
            {
              id: 'p1',
              azsId: 'id-121',
              fuelType: 'A92',
              price: 63.9,
              trend: 'stable',
            },
          ],
        },
      })
    }
    if (url === '/analytics/competitors')
      return Promise.resolve({
        data: { data: { sections: [{ chart: null }] } },
      })
    return Promise.resolve({ data: { data: [] } })
  })
}

const mountView = () => mount(AzsDetailView, { global: { plugins: [] } })
const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text() === text)

describe('AzsDetailView (карточка АЗС)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useAuthStore().user = {
      username: 'manager',
      role: 'manager',
      permissions: [],
    }
  })

  it('показывает паспорт станции и её цены', async () => {
    respondOk()

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('АЗС 121')
    expect(wrapper.text()).toContain('Федеральная трасса')
    expect(wrapper.text()).toContain('A92')
    expect(wrapper.text()).toContain('63.9')
  })

  it('менеджер редактирует станцию и видит сохранённые данные', async () => {
    respondOk()
    azsAPI.update.mockResolvedValue({
      data: { data: { ...station, address: 'Новая улица' } },
    })

    const wrapper = mountView()
    await flushPromises()
    await button(wrapper, 'Редактировать').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(azsAPI.update).toHaveBeenCalledWith(
      'id-121',
      expect.objectContaining({ name: 'АЗС 121' })
    )
    expect(wrapper.text()).toContain('Новая улица')
  })

  it('показывает ошибку сохранения и не закрывает форму', async () => {
    respondOk()
    azsAPI.update.mockRejectedValue({
      response: { data: { error: 'Нет прав на станцию' } },
    })

    const wrapper = mountView()
    await flushPromises()
    await button(wrapper, 'Редактировать').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Нет прав на станцию')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('аналитик не видит кнопку «Редактировать»', async () => {
    respondOk()
    useAuthStore().user = {
      username: 'analyst',
      role: 'analyst',
      permissions: [],
    }

    const wrapper = mountView()
    await flushPromises()

    expect(button(wrapper, 'Редактировать')).toBeUndefined()
  })

  it('для несуществующей станции показывает «Станция не найдена»', async () => {
    azsAPI.getById.mockRejectedValue({ response: { status: 404, data: {} } })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Станция не найдена')
  })
})
