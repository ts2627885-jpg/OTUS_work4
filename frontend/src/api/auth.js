import client from './client'

export const authAPI = {
  register(username, email, password) {
    return client.post('/auth/register', {
      username,
      email,
      password
    })
  },

  login(username, password) {
    return client.post('/auth/login', {
      username,
      password
    })
  },

  logout() {
    // Server-side logout (optional - just clear token on client)
    return Promise.resolve()
  },

  getProfile() {
    return client.get('/auth/profile')
  }
}
