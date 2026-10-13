import client from './client'

// Путь соответствует backend/src/routes/dashboard.routes.ts
export const dashboardAPI = {
  get(params = {}) {
    return client.get('/dashboard', { params })
  },
}
