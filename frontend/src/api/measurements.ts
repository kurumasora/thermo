import client from './client'

export const getLatestMeasurements = () => client.get('/api/measurements/latest')
export const getMeasurements = (params: Record<string, string>) =>
  client.get('/api/measurements', { params })
