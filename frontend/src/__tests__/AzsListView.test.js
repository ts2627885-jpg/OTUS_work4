import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/azs', () => ({
  azsAPI: { getAll: vi.fn(), create: vi.fn(), delete: vi.fn() },
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
}))

import { azsAPI } from '@/api/azs'
import AzsListView from '@/views/AzsListView.vue'
import { useAuthStore } from '@/stores/auth'

const station = (name, status = 'active') => ({
  id: `id-${name}`,
  name,
  region: 'Tver region',
  fuelTypes: ['A92', 'DT'],
  manager: null,
  status,
  address: 'Федеральная трасса',
  latitude: null,
  longitude: null,
})

describe('AzsListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useAuthStore().user = {
      username: 'admin',
      role: 'admin',
      permissions: ['*'],
    }
  })

  it('выводит станции из ответа API и счётчик найденных', async () => {
    azsAPI.getAll.mockResolvedValue({
      data: { data: [station('АЗС 121'), station('АЗС 122')] },
    })

    const wrapper = mount(AzsListView, { global: { plugins: [] } })
    await flushPromises()

    expect(wrapper.text()).toContain('АЗС 121')
    expect(wrapper.text()).toContain('АЗС 122')
    expect(wrapper.text()).toContain('Найдено: 2 из 2')
  })

  it('показывает понятную ошибку, если список не загрузился', async () => {
    azsAPI.getAll.mockRejectedValue({
      response: { data: { error: 'Нет связи с сервером' } },
    })

    const wrapper = mount(AzsListView, { global: { plugins: [] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Не удалось загрузить станции: Нет связи с сервером')
  })
})
