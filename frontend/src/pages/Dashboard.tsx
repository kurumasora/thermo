import { useEffect, useState } from 'react'
import axios from 'axios'

type Measurement = {
  id: number
  timestamp: string
  temp_ch1: number
  temp_ch2: number
  battery_level: number | null
}

type Alert = {
  id: number
  timestamp: string
  channel: number
  alert_type: string
  value: number
  message: string
}

function Dashboard() {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    axios.get('/api/measurements', { headers }).then(res => setMeasurements(res.data))
    axios.get('/api/alerts', { headers }).then(res => setAlerts(res.data))
  }, [])

  return (
    <div>
      <h1>ダッシュボード</h1>
      <h2>最新の計測データ</h2>
      <table>
        <thead>
          <tr>
            <th>タイムスタンプ</th>
            <th>CH1温度</th>
            <th>CH2温度</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map(m => (
            <tr key={m.id}>
              <td>{m.timestamp}</td>
              <td>{m.temp_ch1}℃</td>
              <td>{m.temp_ch2}℃</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>アラート履歴</h2>
      <table>
        <thead>
          <tr>
            <th>タイムスタンプ</th>
            <th>CH</th>
            <th>種別</th>
            <th>値</th>
            <th>メッセージ</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map(a => (
            <tr key={a.id}>
              <td>{a.timestamp}</td>
              <td>{a.channel}</td>
              <td>{a.alert_type}</td>
              <td>{a.value}℃</td>
              <td>{a.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Dashboard