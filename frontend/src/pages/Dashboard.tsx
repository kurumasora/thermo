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

const POLL_INTERVAL_MS = 10 * 60 * 1000
const MEAS_PAGE_SIZE = 20
const ALERT_PAGE_SIZE = 20

function Dashboard() {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [measPage, setMeasPage] = useState(1)
  const [alertPage, setAlertPage] = useState(1)

  const fetchData = () => {
    Promise.all([
      client.get('/api/measurements'),
      client.get('/api/alerts'),
    ]).then(([measRes, alertRes]) => {
      setMeasurements(measRes.data)
      setAlerts(alertRes.data)
      setLastUpdated(new Date())
    })
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const measSlice = measurements.slice((measPage - 1) * MEAS_PAGE_SIZE, measPage * MEAS_PAGE_SIZE)
  const measTotal = Math.ceil(measurements.length / MEAS_PAGE_SIZE)
  const alertSlice = alerts.slice((alertPage - 1) * ALERT_PAGE_SIZE, alertPage * ALERT_PAGE_SIZE)
  const alertTotal = Math.ceil(alerts.length / ALERT_PAGE_SIZE)

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
        <h1>ダッシュボード</h1>
        {lastUpdated && (
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            最終更新：{lastUpdated.toLocaleTimeString('ja-JP')}
          </span>
        )}
      </div>

      <h2>最新の計測データ</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.5rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>タイムスタンプ</th>
            <th style={thStyle}>CH1温度</th>
            <th style={thStyle}>CH2温度</th>
          </tr>
        </thead>
        <tbody>
          {measSlice.map(m => (
            <tr key={m.id}>
              <td style={tdStyle}>{m.timestamp}</td>
              <td style={tdStyle}>{m.temp_ch1}℃</td>
              <td style={tdStyle}>{m.temp_ch2}℃</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={measPage} total={measTotal} onChange={setMeasPage} />

      <h2 style={{ marginTop: '2rem' }}>アラート履歴</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.5rem' }}>
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
          {alertSlice.map(a => (
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
      <Pagination page={alertPage} total={alertTotal} onChange={setAlertPage} />
    </div>
  )
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
      <button onClick={() => onChange(page - 1)} disabled={page === 1}>＜</button>
      <span style={{ fontSize: '0.9rem' }}>{page} / {total}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === total}>＞</button>
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
