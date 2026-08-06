import client from './client'

export const getSensors = () => client.get('/api/sensors')
export const getSensorMapKeys = () => client.get('/api/admin/sensor-map-keys')
export const createSensor = (data: { sensor_key: string; name: string; channels: unknown[] }) =>
  client.post('/api/admin/sensors', data)
export const deleteSensor = (id: number) => client.delete(`/api/admin/sensors/${id}`)
export const toggleSensorActive = (id: number) => client.put(`/api/admin/sensors/${id}/active`)
export const getSensorEmailRecipients = (sensorId: number) =>
  client.get(`/api/admin/sensors/${sensorId}/email-recipients`)
export const addEmailRecipient = (sensorId: number, email: string) =>
  client.post(`/api/admin/sensors/${sensorId}/email-recipients`, { email })
export const deleteEmailRecipient = (recipientId: number) =>
  client.delete(`/api/admin/email-recipients/${recipientId}`)
export const updateSensorNotification = (id: number, data: unknown) =>
  client.put(`/api/admin/sensors/${id}/notification`, data)
export const updateSensorWebhook = (id: number, webhookUrl: string | null) =>
  client.put(`/api/admin/sensors/${id}/webhook`, { webhook_url: webhookUrl })
