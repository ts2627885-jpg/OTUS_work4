import client from './client'

export const azsAPI = {
  // Get all AZS stations
  getAll(filters = {}) {
    return client.get('/azs', { params: filters })
  },

  // Get single AZS
  getById(id) {
    return client.get(`/azs/${id}`)
  },

  // Create new AZS
  create(data) {
    return client.post('/azs', data)
  },

  // Update AZS
  update(id, data) {
    return client.put(`/azs/${id}`, data)
  },

  // Delete AZS
  delete(id) {
    return client.delete(`/azs/${id}`)
  },

  // Get fuel sales for AZS
  getSales(azsId, dateRange) {
    return client.get(`/azs/${azsId}/sales`, { params: dateRange })
  },

  // Get traffic data for AZS
  getTraffic(azsId, dateRange) {
    return client.get(`/azs/${azsId}/traffic`, { params: dateRange })
  },

  // Get competitor prices
  getCompetitors(azsId) {
    return client.get(`/azs/${azsId}/competitors`)
  },

  // Get weather data
  getWeather(azsId, dateRange) {
    return client.get(`/azs/${azsId}/weather`, { params: dateRange })
  },
}
