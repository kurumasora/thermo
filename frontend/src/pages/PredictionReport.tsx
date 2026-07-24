import { useEffect, useState } from 'react'
import client from '../api/client'
import { formatTimestamp } from '../utils/format'

type Summary = {
  total: number
  verified: number
  hits: number
  misses: number
  pending: number
  accuracy_pct: number | null
}

type Record = {
  id: number
  channel: number
  direction: string
  limit_value: number
  predicted_at: string
  created_at: string
  verified: boolean
  verified_at: string | null
  outcome: string | null
  alert_message: string
}

function PredictionReport() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [records, setRecords] = useState<Record[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchAll = () => {
    client.get('/api/admin/prediction/settings').then(r => setEnabled(r.data.enabled))
    client.get('/api/admin/prediction/report').then(r => {
      setSummary(r.data.summary)
      setRecords(r.data.records)
    })
  }

  useEffect(() => { fetchAll() }, [])

  const toggleEnabled = async () => {
    const next = !enabled
    await client.put('/api/admin/prediction/settings', { enabled: next })
    setEnabled(next)
    showToast(next ? '予測追跡を有効にしました' : '予測追跡を無効にしました')
  }

  const outcomeLabel = (outcome: string | null, verified: boolean) => {
    if (!verified) return <span style={{ color: '#64748b' }}>未検証</span>
    if (outcome === 'hit') return <span style={{ color: '#16a34a', fontWeight: 'bold' }}>的中</span>
    return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>外れ</span>
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
          background: '#1e293b', color: '#fff', padding: '0.75rem 1.25rem',
          borderRadius: '6px', fontSize: '0.9rem',
        }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>傾向予測 精度レポート</h1>
        {enabled !== null && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
            予測追跡を有効にする
          </label>
        )}
      </div>

      {summary && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <StatCard label="総予測数" value={String(summary.total)} />
          <StatCard label="検証済み" value={String(summary.verified)} />
          <StatCard label="的中" value={String(summary.hits)} color="#16a34a" />
          <StatCard label="外れ" value={String(summary.misses)} color="#ef4444" />
          <StatCard label="未検証" value={String(summary.pending)} color="#64748b" />
          <StatCard
            label="的中率"
            value={summary.accuracy_pct != null ? `${summary.accuracy_pct}%` : '—'}
            color={summary.accuracy_pct != null && summary.accuracy_pct >= 70 ? '#16a34a' : '#f59e0b'}
          />
        </div>
      )}

      <h2>予測履歴（直近50件）</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>発報日時</th>
            <th style={thStyle}>CH</th>
            <th style={thStyle}>方向</th>
            <th style={thStyle}>予測到達閾値</th>
            <th style={thStyle}>予測到達時刻</th>
            <th style={thStyle}>結果</th>
            <th style={thStyle}>検証日時</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} style={{ background: r.outcome === 'hit' ? '#f0fdf4' : r.outcome === 'miss' ? '#fef2f2' : undefined }}>
              <td style={tdStyle}>{formatTimestamp(r.created_at)}</td>
              <td style={tdStyle}>CH{r.channel}</td>
              <td style={tdStyle}>{r.direction === 'up' ? '↑ 上昇' : '↓ 下降'}</td>
              <td style={tdStyle}>{r.limit_value}℃</td>
              <td style={tdStyle}>{formatTimestamp(r.predicted_at)}</td>
              <td style={tdStyle}>{outcomeLabel(r.outcome, r.verified)}</td>
              <td style={tdStyle}>{r.verified_at ? formatTimestamp(r.verified_at) : '—'}</td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>
                予測データがありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: '8px',
      padding: '0.75rem 1.25rem', minWidth: '100px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: color ?? '#1e293b' }}>{value}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem', background: '#f1f5f9', textAlign: 'left',
}
const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem',
}

export default PredictionReport
