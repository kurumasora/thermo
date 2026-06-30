import { useEffect, useState } from 'react'
import client from '../api/client'

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
  predicted_steps: number | null
}

function Dashboard() {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    client.get('/api/measurements').then(res => setMeasurements(res.data))
    client.get('/api/alerts').then(res => setAlerts(res.data))
  }, [])

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>ダッシュボード</h1>

      <h2>最新の計測データ</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '2rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>タイムスタンプ</th>
            <th style={thStyle}>CH1温度</th>
            <th style={thStyle}>CH2温度</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map(m => (
            <tr key={m.id}>
              <td style={tdStyle}>{m.timestamp}</td>
              <td style={tdStyle}>{m.temp_ch1}℃</td>
              <td style={tdStyle}>{m.temp_ch2}℃</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>アラート履歴</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>タイムスタンプ</th>
            <th style={thStyle}>CH</th>
            <th style={thStyle}>種別</th>
            <th style={thStyle}>値</th>
            <th style={thStyle}>メッセージ</th>
            <th style={thStyle}>閾値到達予測</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map(a => (
            <tr key={a.id} style={{ background: a.alert_type === 'threshold' ? '#fef2f2' : '#fffbeb' }}>
              <td style={tdStyle}>{a.timestamp}</td>
              <td style={tdStyle}>CH{a.channel}</td>
              <td style={tdStyle}>
                <span style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  background: a.alert_type === 'threshold' ? '#ef4444' : '#f59e0b',
                  color: '#fff'
                }}>
                  {a.alert_type === 'threshold' ? '閾値超過' : '傾向異常'}
                </span>
              </td>
              <td style={tdStyle}>{a.value}℃</td>
              <td style={tdStyle}>{a.message}</td>
              <td style={tdStyle}>
                {a.predicted_steps != null ? (
                  <span style={{ color: '#b45309', fontWeight: 'bold' }}>
                    約{a.predicted_steps}ステップ後
                  </span>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '0.5rem',
  background: '#f1f5f9',
  textAlign: 'left',
}

const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '0.5rem',
}

export default Dashboard
