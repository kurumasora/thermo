import client from './client'

export const login = (username: string, password: string) =>
  client.post('/api/auth/login', { username, password })
export const changePassword = (currentPassword: string, newPassword: string) =>
  client.put('/api/auth/password', { current_password: currentPassword, new_password: newPassword })
