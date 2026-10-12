import client from './client'

export const importAPI = {
  // Upload and import CSV file
  importCSV(file, dataType) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('dataType', dataType)

    return client.post('/import/csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // Get import history
  getHistory(filters = {}) {
    return client.get('/import/history', { params: filters })
  },

  // Get import details
  getDetails(importId) {
    return client.get(`/import/${importId}`)
  },

  // Retry failed import
  retry(importId) {
    return client.post(`/import/${importId}/retry`)
  },

  // Get import templates
  getTemplates() {
    return client.get('/import/templates')
  },

  // Download template
  downloadTemplate(templateName) {
    return client.get(`/import/templates/${templateName}/download`, {
      responseType: 'blob'
    })
  }
}
