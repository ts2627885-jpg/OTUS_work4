import client from './client'

export const recommendationsAPI = {
  // Get recommendations for AZS
  getForAzs(azsId, filters = {}) {
    return client.get(`/recommendations/azs/${azsId}`, { params: filters })
  },

  // Get all recommendations (admin view)
  getAll(filters = {}) {
    return client.get('/recommendations', { params: filters })
  },

  // Get single recommendation
  getById(id) {
    return client.get(`/recommendations/${id}`)
  },

  // Mark recommendation as completed
  markAsCompleted(id, data = {}) {
    return client.post(`/recommendations/${id}/complete`, data)
  },

  // Generate recommendations for AZS
  generate(azsId) {
    return client.post(`/recommendations/generate/${azsId}`)
  },

  // Get recommendation analytics
  getAnalytics(azsId, dateRange) {
    return client.get(`/recommendations/analytics/${azsId}`, { params: dateRange })
  }
}
