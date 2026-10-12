import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

// Режим моков (npm run dev:mock): ответы берутся из фикстур, backend не нужен.
// Модуль моков подгружается лениво, поэтому в обычной сборке он не попадает в бандл.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
const mockAdapter = (config) => import('@/mocks/mockAdapter').then((m) => m.default(config))

// Create axios instance with base URL
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  adapter: USE_MOCKS ? mockAdapter : undefined,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - add JWT token to every request
client.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle 401 and refresh token
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authStore = useAuthStore()
    const originalRequest = error.config

    // If 401 and not a retry, logout user
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      authStore.logout()
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default client
