import client from './client'

export const getSettings = () => client.get('/api/settings')
export const updateSettings = (sensorChannelId: number, data: unknown) =>
  client.put(`/api/settings/${sensorChannelId}`, data)
export const getJudgementTypes = () => client.get('/api/judgement-types')
export const getAppSettings = () => client.get('/api/app-settings')
export const updateAppSetting = (key: string, value: string) =>
  client.put(`/api/app-settings/${key}`, { value })
