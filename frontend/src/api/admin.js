import client from './client'

export const adminAPI = {
  // Users management
  users: {
    getAll(filters = {}) {
      return client.get('/admin/users', { params: filters })
    },
    getById(id) {
      return client.get(`/admin/users/${id}`)
    },
    create(data) {
      return client.post('/admin/users', data)
    },
    update(id, data) {
      return client.put(`/admin/users/${id}`, data)
    },
    delete(id) {
      return client.delete(`/admin/users/${id}`)
    }
  },

  // Roles management
  roles: {
    getAll() {
      return client.get('/admin/roles')
    },
    getById(id) {
      return client.get(`/admin/roles/${id}`)
    },
    create(data) {
      return client.post('/admin/roles', data)
    },
    update(id, data) {
      return client.put(`/admin/roles/${id}`, data)
    },
    delete(id) {
      return client.delete(`/admin/roles/${id}`)
    }
  },

  // Permissions management
  permissions: {
    getAll() {
      return client.get('/admin/permissions')
    },
    assignToRole(roleId, permissions) {
      return client.post(`/admin/roles/${roleId}/permissions`, { permissions })
    }
  },

  // System logs
  logs: {
    getLoginLogs(filters = {}) {
      return client.get('/admin/logs/login', { params: filters })
    },
    getAuditLogs(filters = {}) {
      return client.get('/admin/logs/audit', { params: filters })
    }
  },

  // Statistics
  stats: {
    getOverall() {
      return client.get('/admin/stats/overall')
    },
    getUserStats() {
      return client.get('/admin/stats/users')
    },
    getAzsStats() {
      return client.get('/admin/stats/azs')
    }
  }
}
