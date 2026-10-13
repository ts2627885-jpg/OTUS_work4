import client from './client'

// Пути соответствуют backend/src/routes/analytics.routes.ts и server.ts
export const analyticsAPI = {
  tab(tab, params = {}) {
    return client.get(`/analytics/${tab}`, { params })
  },
  pricesList() {
    return client.get('/prices')
  },
}
