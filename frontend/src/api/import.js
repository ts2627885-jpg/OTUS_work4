import client from './client'

// Пути соответствуют backend/src/routes/import.routes.ts
export const importAPI = {
  upload(formData) {
    return client.post('/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  history() {
    return client.get('/import/history')
  },
  summary() {
    return client.get('/import/summary')
  },
}
