import { useEffect, useState } from 'react'
import client from '../api/client'
import { formatTimestamp } from '../utils/format'

type Alert = {
  id: number
  timestamp: string
  sensor_channel_id: number
  channel_name: string
  unit: string
  sensor_name: string
  sensor_id: number
  alert_type: string
  value: number
  message: string
  predicted_steps: number | null
}

type Sensor = { id: number; name: string }

const PAGE_SIZE = 20

function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [filterType, setFilterType] = useState<'all' | 'threshold' | 'trend'>('all')
  const [filterSensorId, setFilterSensorId] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [csvFrom, setCsvFrom] = useState('')
  const [csvTo, setCsvTo] = useState('')

  useEffect(() => {
    client.get('/api/alerts').then(res => {
      setAlerts(res.data)
      const seen = new Set<number>()
      const sensorList: Sensor[] = []
      for (const a of res.data) {
        if (!seen.has(a.sensor_id)) {
          seen.add(a.sensor_id)
          sensorList.push({ id: a.sensor_id, name: a.sensor_name })
        }
      }
      setSensors(sensorList)
    })
  }, [])

  const handleCsvDownload = () => {
    const params = new URLSearchParams()
    if (filterSensorId !== 'all') params.append('sensor_id', filterSensorId)
    if (filterType !== 'all') params.append('alert_type', filterType)
    if (csvFrom) params.append('date_from', csvFrom)
    if (csvTo) params.append('date_to', csvTo)
    const token = localStorage.getItem('token')
    fetch(`/api/alerts/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'alerts.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  const filtered = alerts.filter(a => {
    if (filterType !== 'all' && a.alert_type !== filterType) return false
    if (filterSensorId !== 'all' && String(a.sensor_id) !== filterSensorId) return false
    return true
  })
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>アラート履歴</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: '0.9rem' }}>
          種別：
          <select value={filterType} onChange={e => { setFilterType(e.target.value as typeof filterType); setPage(1) }} style={{ marginLeft: '0.25rem' }}>
            <option value="all">すべて</option>
            <option value="threshold">閾値超過</option>
            <option value="trend">傾向異常</option>
          </select>
        </label>
        <label style={{ fontSize: '0.9rem' }}>
          センサ：
          <select value={filterSensorId} onChange={e => { setFilterSensorId(e.target.value); setPage(1) }} style={{ marginLeft: '0.25rem' }}>
            <option value="all">すべて</option>
            {sensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{filtered.length}件</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', color: '#64748b' }}>期間：</label>
          <input type="date" value={csvFrom} onChange={e => setCsvFrom(e.target.value)} style={{ fontSize: '0.85rem' }} />
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>〜</span>
          <input type="date" value={csvTo} onChange={e => setCsvTo(e.target.value)} style={{ fontSize: '0.85rem' }} />
          <button onClick={handleCsvDownload} style={{ fontSize: '0.85rem' }}>CSVダウンロード</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.5rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>タイムスタンプ</th>
              <th style={thStyle}>センサ / チャンネル</th>
              <th style={thStyle}>種別</th>
              <th style={thStyle}>値</th>
              <th style={thStyle}>メッセージ</th>
              <th style={thStyle}>閾値到達まで</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(a => (
              <tr key={a.id} style={{ background: a.alert_type === 'threshold' ? '#fef2f2' : '#fffbeb' }}>
                <td style={tdStyle}>{formatTimestamp(a.timestamp)}</td>
                <td style={tdStyle}>{a.sensor_name}<br /><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{a.channel_name}</span></td>
                <td style={tdStyle}>
                  <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', background: a.alert_type === 'threshold' ? '#ef4444' : '#f59e0b', color: '#fff' }}>
                    {a.alert_type === 'threshold' ? '閾値超過' : '傾向異常'}
                  </span>
                </td>
                <td style={tdStyle}>{a.value}{a.unit}</td>
                <td style={tdStyle}>{a.message}</td>
                <td style={tdStyle}>
                  {a.predicted_steps != null
                    ? <span style={{ color: '#b45309', fontWeight: 'bold' }}>
                        {(() => { const m = a.predicted_steps * 10; return m >= 60 ? `約${(m / 60).toFixed(1)}時間後` : `約${Math.round(m)}分後` })()}
                      </span>
                    : '—'}
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>該当するアラートはありません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>＜</button>
          <span style={{ fontSize: '0.9rem' }}>{page} / {total}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === total}>＞</button>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '0.5rem', background: '#f1f5f9', textAlign: 'left' }
const tdStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '0.5rem' }

export default Alerts
