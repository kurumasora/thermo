import client from './client'

export const getSmtpConfig = () => client.get('/api/admin/smtp-config')
export const updateSmtpConfig = (data: unknown) => client.put('/api/admin/smtp-config', data)
