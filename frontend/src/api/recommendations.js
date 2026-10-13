import client from './client'

// Пути соответствуют backend/src/routes/recommendations.routes.ts и stations.routes.ts
export const recommendationsAPI = {
  list(filters = {}) {
    return client.get('/recommendations', { params: filters })
  },
  complete(id) {
    return client.post(`/recommendations/${id}/complete`)
  },
  generate() {
    return client.post('/recommendations/generate')
  },
  stationCheck() {
    return client.get('/stations/check')
  },
  rules() {
    return client.get('/analysis/rules')
  },
}
