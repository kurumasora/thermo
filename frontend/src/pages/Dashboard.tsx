import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts'
import client from '../api/client'
import { formatTimestamp } from '../utils/format'

type Measurement = {
  id: number
  timestamp: string
  temp_ch1: number
  temp_ch2: number
  battery_level: number | null
}

type Config = {
  channel: number
  upper_threshold: number
  lower_threshold: number
}

const POLL_INTERVAL_MS = 10 * 60 * 1000
const PAGE_SIZE_OPTIONS = [20, 50, 100]

function Dashboard() {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [measPage, setMeasPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const fetchData = () => {
    Promise.all([
      client.get('/api/measurements'),
      client.get('/api/settings'),
    ]).then(([measRes, settingsRes]) => {
      setMeasurements(measRes.data)
      setConfigs(settingsRes.data)
      setLastUpdated(new Date())
    })
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const latest = measurements[0]
  const ch1Config = configs.find(c => c.channel === 1)
  const ch2Config = configs.find(c => c.channel === 2)

  const ch1Status = latest && ch1Config
    ? latest.temp_ch1 > ch1Config.upper_threshold || latest.temp_ch1 < ch1Config.lower_threshold
      ? 'danger' : 'normal'
    : 'normal'
  const ch2Status = latest && ch2Config
    ? latest.temp_ch2 > ch2Config.upper_threshold || latest.temp_ch2 < ch2Config.lower_threshold
      ? 'danger' : 'normal'
    : 'normal'

  const graphData = [...measurements].reverse().slice(-24).map(m => ({
    time: formatTimestamp(m.timestamp).slice(5),  // MM/DD HH:mm
    CH1: m.temp_ch1,
    CH2: m.temp_ch2,
  }))

  const measSlice = measurements.slice((measPage - 1) * pageSize, measPage * pageSize)
  const measTotal = Math.ceil(measurements.length / pageSize)

  return (
    <div style={{ padding: '1.5rem' }}>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>ダッシュボード</h1>
        {lastUpdated && (
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            最終更新：{lastUpdated.toLocaleTimeString('ja-JP')}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <TempCard
          label="CH1 現在温度"
          value={latest?.temp_ch1}
          upper={ch1Config?.upper_threshold}
          lower={ch1Config?.lower_threshold}
          status={ch1Status}
        />
        <TempCard
          label="CH2 現在温度"
          value={latest?.temp_ch2}
          upper={ch2Config?.upper_threshold}
          lower={ch2Config?.lower_threshold}
          status={ch2Status}
        />
      </div>

      <h2>温度推移（直近24件）</h2>
      <div style={{ marginBottom: '2rem' }}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={graphData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="℃" />
            <Tooltip formatter={(v) => `${v}℃`} />
            <Legend />
            {ch1Config && <ReferenceLine y={ch1Config.upper_threshold} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'CH1上限', fontSize: 11, fill: '#ef4444' }} />}
            {ch1Config && <ReferenceLine y={ch1Config.lower_threshold} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: 'CH1下限', fontSize: 11, fill: '#3b82f6' }} />}
            <Line type="monotone" dataKey="CH1" stroke="#f59e0b" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="CH2" stroke="#6366f1" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>計測データ一覧</h2>
        <label style={{ fontSize: '0.9rem', color: '#64748b' }}>
          表示件数：
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setMeasPage(1) }}
            style={{ marginLeft: '0.25rem' }}
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}件</option>)}
          </select>
        </label>
      </div>
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
              <td style={tdStyle}>{formatTimestamp(m.timestamp)}</td>
              <td style={tdStyle}>{m.temp_ch1}℃</td>
              <td style={tdStyle}>{m.temp_ch2}℃</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={measPage} total={measTotal} onChange={setMeasPage} />
    </div>
  )
}

function TempCard({ label, value, upper, lower, status }: {
  label: string
  value: number | undefined
  upper: number | undefined
  lower: number | undefined
  status: 'normal' | 'danger'
}) {
  const bg = status === 'danger' ? '#fef2f2' : '#f0fdf4'
  const color = status === 'danger' ? '#ef4444' : '#16a34a'
  return (
    <div style={{
      background: bg, border: `2px solid ${color}`, borderRadius: '8px',
      padding: '1rem 1.5rem', minWidth: '180px', flex: '1 1 180px', maxWidth: '260px'
    }}>
      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color, lineHeight: 1.1 }}>
        {value != null ? `${value}℃` : '—'}
      </div>
      {upper != null && lower != null && (
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.4rem' }}>
          範囲：{lower}℃〜{upper}℃
        </div>
      )}
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
  border: '1px solid #ccc', padding: '0.5rem', background: '#f1f5f9', textAlign: 'left',
}
const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem',
}

export default Dashboard
