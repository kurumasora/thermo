export type SensorChannel = { id: number; channel_no: number; name: string; unit: string }
export type Sensor = { id: number; sensor_key: string; name: string; active: boolean; channels: SensorChannel[] }
export type Measurement = { id: number; timestamp: string; sensor_channel_id: number; value: number }
export type LatestEntry = { value: number; timestamp: string }
export type ChannelConfig = {
  sensor_channel_id: number; upper_threshold: number; lower_threshold: number; sensor_id: number
}
