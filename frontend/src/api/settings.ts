import client from './client'

export const getSettings = () => client.get('/api/settings')
export const updateSettings = (sensorChannelId: number, data: unknown) =>
  client.put(`/api/settings/${sensorChannelId}`, data)
export const getJudgementTypes = () => client.get('/api/judgement-types')
