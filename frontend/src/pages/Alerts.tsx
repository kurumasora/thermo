import { useEffect, useState } from 'react'
import client from '../api/client'
import { formatTimestamp } from '../utils/format'

type Alert = {
  id: number; timestamp: string; sensor_channel_id: number
  channel_name: string; unit: string; sensor_name: string; sensor_id: number
  alert_type: string; value: number; message: string; predicted_steps: number | null
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
      const list: Sensor[] = []
      for (const a of res.data) {
        if (!seen.has(a.sensor_id)) { seen.add(a.sensor_id); list.push({ id: a.sensor_id, name: a.sensor_name }) }
      }
      setSensors(list)
    })
  }, [])

  const handleCsvDownload = () => {
    const params = new URLSearchParams()
    if (filterSensorId !== 'all') params.append('sensor_id', filterSensorId)
    if (filterType !== 'all') params.append('alert_type', filterType)
    if (csvFrom) params.append('date_from', csvFrom)
    if (csvTo) params.append('date_to', csvTo)
    const token = localStorage.getItem('token')
    fetch(`/api/alerts/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'alerts.csv'; a.click()
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
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '1.75rem 2rem' }}>

      <h1 style={{ fontSize: '1.4rem', fontWeight: 400, color: '#0f172a', margin: '0 0 1.5rem' }}>アラート履歴</h1>

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '1.25rem 1.5rem' }}>

        {/* フィルター */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={labelStyle}>
            種別：
            <select value={filterType} onChange={e => { setFilterType(e.target.value as typeof filterType); setPage(1) }} style={selectStyle}>
              <option value="all">すべて</option>
              <option value="threshold">閾値超過</option>
              <option value="trend">傾向異常</option>
            </select>
          </label>
          <label style={labelStyle}>
            センサ：
            <select value={filterSensorId} onChange={e => { setFilterSensorId(e.target.value); setPage(1) }} style={selectStyle}>
              <option value="all">すべて</option>
              {sensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{filtered.length}件</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>期間：</span>
            <input type="date" value={csvFrom} onChange={e => setCsvFrom(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>〜</span>
            <input type="date" value={csvTo} onChange={e => setCsvTo(e.target.value)} style={inputStyle} />
            <button onClick={handleCsvDownload} style={csvBtnStyle}>CSVダウンロード</button>
          </div>
        </div>

        {/* テーブル */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.83rem' }}>
            <thead>
              <tr>
                {['タイムスタンプ', 'センサ / チャンネル', '種別', '値', 'メッセージ', '閾値到達まで'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={tdStyle}>{formatTimestamp(a.timestamp)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: '#334155' }}>{a.sensor_name}</span>
                    <br />
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{a.channel_name}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600,
                      background: a.alert_type === 'threshold' ? '#fef2f2' : '#fffbeb',
                      color: a.alert_type === 'threshold' ? '#dc2626' : '#b45309',
                    }}>
                      {a.alert_type === 'threshold' ? '閾値超過' : '傾向異常'}
                    </span>
                  </td>
                  <td style={tdStyle}>{a.value}{a.unit}</td>
                  <td style={{ ...tdStyle, maxWidth: '300px', color: '#475569', whiteSpace: 'normal', wordBreak: 'break-word' }}>{a.message}</td>
                  <td style={tdStyle}>
                    {a.predicted_steps != null
                      ? (() => { const m = a.predicted_steps * 10; return <span style={{ color: '#b45309', fontWeight: 600 }}>{m >= 60 ? `約${(m / 60).toFixed(1)}時間後` : `約${Math.round(m)}分後`}</span> })()
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>該当するアラートはありません</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={pageBtnStyle}>‹</button>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{page} / {total}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page === total} style={pageBtnStyle}>›</button>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }
const selectStyle: React.CSSProperties = { fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.25rem 0.4rem', color: '#475569' }
const inputStyle: React.CSSProperties = { fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.25rem 0.5rem', color: '#475569' }
const csvBtnStyle: React.CSSProperties = { fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.25rem 0.75rem', background: '#f8fafc', color: '#475569', cursor: 'pointer' }
const thStyle: React.CSSProperties = { padding: '0.6rem 0.75rem', background: '#f8fafc', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '0.55rem 0.75rem', borderBottom: '1px solid #f1f5f9', color: '#334155', whiteSpace: 'nowrap' }
const pageBtnStyle: React.CSSProperties = { padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: '#475569' }

export default Alerts
