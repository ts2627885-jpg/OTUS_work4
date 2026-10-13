import client from './client'

// Пути соответствуют backend/src/routes/admin.routes.ts (все — только для admin)
export const adminAPI = {
  users() { return client.get('/admin/users') },
  createUser(data) { return client.post('/admin/users', data) },
  updateUser(id, data) { return client.put(`/admin/users/${id}`, data) },
  deleteUser(id) { return client.delete(`/admin/users/${id}`) },
  userStations(id) { return client.get(`/admin/users/${id}/azs`) },
  setUserStations(id, azsIds) { return client.put(`/admin/users/${id}/azs`, { azsIds }) },
  priceTest() { return client.get('/admin/price-test') },
  createPriceTestDraft() { return client.post('/admin/price-test/draft') },
  settings() { return client.get('/admin/settings') },
  settingsHistory() { return client.get('/admin/settings/history') },
  saveSettings(data) { return client.put('/admin/settings', data) },
  exportSettings() { return client.get('/admin/settings/export', { responseType: 'blob' }) },
  importSettings(data) { return client.post('/admin/settings/import', data) },
  overallStats() { return client.get('/admin/stats/overall') },
  logs(kind, params) { return client.get(kind === 'login' ? '/admin/logs/login' : '/admin/logs/audit', { params }) },
}
