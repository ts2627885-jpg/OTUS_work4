import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/auth', () => ({
  authAPI: { login: vi.fn(), register: vi.fn() },
}))

import { authAPI } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

// Минимальное хранилище вместо localStorage (среда тестов — node, без DOM)
const memoryStorage = () => {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
  }
}

const loginResponse = {
  success: true,
  data: {
    token: { access_token: 'token-123', token_type: 'Bearer' },
    user: { id: 'u1', username: 'admin', role: 'admin', permissions: ['*'] },
  },
}

describe('auth store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('сохраняет токен и пользователя при успешном входе', async () => {
    authAPI.login.mockResolvedValue({ data: loginResponse })
    const store = useAuthStore()

    await store.login('admin', 'test-password')

    expect(store.token).toBe('token-123')
    expect(store.user.username).toBe('admin')
    expect(store.isAuthenticated).toBe(true)
    expect(store.isAdmin).toBe(true)
    expect(localStorage.getItem('auth_token')).toBe('token-123')
    expect(store.error).toBeNull()
  })

  it('показывает текст ошибки backend при неверном пароле', async () => {
    authAPI.login.mockRejectedValue({
      response: {
        status: 401,
        data: { success: false, error: 'Invalid credentials' },
      },
    })
    const store = useAuthStore()

    await expect(store.login('admin', 'wrong')).rejects.toBeDefined()

    expect(store.isAuthenticated).toBe(false)
    // 401 на входе показываем понятным текстом, а не серверным «Invalid credentials»
    expect(store.error).toBe('Неверное имя пользователя или пароль.')
  })

  it('logout очищает состояние и хранилище', async () => {
    authAPI.login.mockResolvedValue({ data: loginResponse })
    const store = useAuthStore()
    await store.login('admin', 'test-password')

    store.logout()

    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })
})
