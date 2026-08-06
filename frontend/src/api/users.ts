import client from './client'

export const getUsers = () => client.get('/api/admin/users')
export const createUser = (username: string, password: string, role: string) =>
  client.post('/api/admin/users', { username, password, role })
export const deleteUser = (id: number) => client.delete(`/api/admin/users/${id}`)
export const updateUserRole = (id: number, role: string) =>
  client.put(`/api/admin/users/${id}/role`, { role })
export const updateUserPassword = (id: number, password: string) =>
  client.put(`/api/admin/users/${id}/password`, { password })
