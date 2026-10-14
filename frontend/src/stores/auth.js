import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authAPI } from '@/api/auth'
import { errorMessage } from '@/composables/useRequest'

// Ошибки входа и регистрации: неверные данные (401) показываем понятно, остальное — общим способом
const authErrorMessage = (err, fallback) =>
  err.response?.status === 401
    ? 'Неверное имя пользователя или пароль.'
    : errorMessage(err) || fallback

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('auth_token') || null)
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isManager = computed(() => user.value?.role === 'manager')
  const isAnalyst = computed(() => user.value?.role === 'analyst')
  const isViewer = computed(() => user.value?.role === 'viewer')

  // Права экранов по ролям (FR-2.1). Имена совпадают с requiredPermissions в роутере и меню.
  // Права из базы (user.permissions) добавляются к ним; '*' — полный доступ.
  const ROLE_SCREENS = {
    admin: ['*'],
    manager: ['azs_view_all', 'azs_view_own', 'recommendations_view', 'data_import'],
    analyst: ['azs_view_all', 'recommendations_view'],
    viewer: ['azs_view_all', 'recommendations_view'],
  }

  const hasPermission = (permission) => {
    if (!user.value) return false
    const perms = [...(ROLE_SCREENS[user.value.role] || []), ...(user.value.permissions || [])]
    return perms.includes('*') || perms.includes(permission)
  }

  // Actions
  const register = async (username, email, password) => {
    loading.value = true
    error.value = null
    try {
      const response = await authAPI.register(username, email, password)
      // Auto-login after registration
      await login(username, password)
      return response.data
    } catch (err) {
      // backend отвечает { success: false, error: '...' }
      error.value = authErrorMessage(err, 'Не удалось зарегистрироваться.')
      throw err
    } finally {
      loading.value = false
    }
  }

  const login = async (username, password) => {
    loading.value = true
    error.value = null
    try {
      const response = await authAPI.login(username, password)
      token.value = response.data.data.token.access_token
      user.value = response.data.data.user

      // Save token to localStorage
      localStorage.setItem('auth_token', token.value)
      localStorage.setItem('user', JSON.stringify(user.value))

      return response.data
    } catch (err) {
      error.value = authErrorMessage(err, 'Не удалось войти.')
      throw err
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    token.value = null
    user.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    error.value = null
  }

  const restoreFromStorage = () => {
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('user')

    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        // Сессия без роли записана старой версией входа: без роли меню и права не работают, нужен повторный вход
        if (!parsed?.role) throw new Error('stored user has no role')
        token.value = storedToken
        user.value = parsed
      } catch (err) {
        console.error('Stored session is not usable, logging out:', err)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
        token.value = null
        user.value = null
      }
    }
  }

  // Initialize
  restoreFromStorage()

  return {
    // State
    user,
    token,
    loading,
    error,

    // Computed
    isAuthenticated,
    isAdmin,
    isManager,
    isAnalyst,
    isViewer,
    hasPermission,

    // Actions
    register,
    login,
    logout,
    restoreFromStorage,
  }
})
