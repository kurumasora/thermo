import { useEffect, useState } from 'react'
import client from '../api/client'
import { formatTimestamp } from '../utils/format'

type Alert = {
  id: number
  timestamp: string
  channel: number
  alert_type: string
  value: number
  message: string
  predicted_steps: number | null
}

const PAGE_SIZE = 20

function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filterType, setFilterType] = useState<'all' | 'threshold' | 'trend'>('all')
  const [filterChannel, setFilterChannel] = useState<'all' | '1' | '2'>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    client.get('/api/alerts').then(res => setAlerts(res.data))
  }, [])

  const filtered = alerts.filter(a => {
    if (filterType !== 'all' && a.alert_type !== filterType) return false
    if (filterChannel !== 'all' && a.channel !== Number(filterChannel)) return false
    return true
  })
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>アラート履歴</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.9rem' }}>
          種別：
          <select value={filterType} onChange={e => { setFilterType(e.target.value as typeof filterType); setPage(1) }} style={{ marginLeft: '0.25rem' }}>
            <option value="all">すべて</option>
            <option value="threshold">閾値超過</option>
            <option value="trend">傾向異常</option>
          </select>
        </label>
        <label style={{ fontSize: '0.9rem' }}>
          チャンネル：
          <select value={filterChannel} onChange={e => { setFilterChannel(e.target.value as typeof filterChannel); setPage(1) }} style={{ marginLeft: '0.25rem' }}>
            <option value="all">すべて</option>
            <option value="1">CH1</option>
            <option value="2">CH2</option>
          </select>
        </label>
        <span style={{ fontSize: '0.85rem', color: '#64748b', alignSelf: 'center' }}>
          {filtered.length}件
        </span>
      </div>

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
          {slice.map(a => (
            <tr key={a.id} style={{ background: a.alert_type === 'threshold' ? '#fef2f2' : '#fffbeb' }}>
              <td style={tdStyle}>{formatTimestamp(a.timestamp)}</td>
              <td style={tdStyle}>CH{a.channel}</td>
              <td style={tdStyle}>
                <span style={{
                  padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem',
                  background: a.alert_type === 'threshold' ? '#ef4444' : '#f59e0b',
                  color: '#fff'
                }}>
                  {a.alert_type === 'threshold' ? '閾値超過' : '傾向異常'}
                </span>
              </td>
              <td style={tdStyle}>{a.value}℃</td>
              <td style={tdStyle}>{a.message}</td>
              <td style={tdStyle}>
                {a.predicted_steps != null
                  ? <span style={{ color: '#b45309', fontWeight: 'bold' }}>約{a.predicted_steps}ステップ後</span>
                  : '—'}
              </td>
            </tr>
          ))}
          {slice.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>
                該当するアラートはありません
              </td>
            </tr>
          )}
        </tbody>
      </table>

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

const thStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem', background: '#f1f5f9', textAlign: 'left',
}
const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem',
}

export default Alerts
