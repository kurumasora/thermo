import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts'
import client from '../api/client'
import { formatTimestamp } from '../utils/format'

type SensorChannel = { id: number; channel_no: number; name: string; unit: string }
type Sensor = { id: number; sensor_key: string; name: string; active: boolean; channels: SensorChannel[] }
type Measurement = { id: number; timestamp: string; sensor_channel_id: number; value: number }
type LatestEntry = { value: number; timestamp: string }
type ChannelConfig = {
  sensor_channel_id: number; upper_threshold: number; lower_threshold: number; sensor_id: number
}

const POLL_INTERVAL_MS = 10 * 60 * 1000
const PAGE_SIZE_OPTIONS = [20, 50, 100]
const LINE_COLORS = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

function Dashboard() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [latest, setLatest] = useState<Record<string, LatestEntry>>({})
  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const fetchData = useCallback(() => {
    Promise.all([
      client.get('/api/sensors'),
      client.get('/api/measurements'),
      client.get('/api/measurements/latest'),
      client.get('/api/settings'),
    ]).then(([sRes, mRes, lRes, cRes]) => {
      setSensors(sRes.data.filter((s: Sensor) => s.active))
      setMeasurements(mRes.data)
      setLatest(lRes.data)
      setConfigs(cRes.data)
      setLastUpdated(new Date())
    })
  }, [])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchData])

  const getConfig = (channelId: number) => configs.find(c => c.sensor_channel_id === channelId)

  const isChannelDanger = (channelId: number): boolean => {
    const cfg = getConfig(channelId)
    const lat = latest[String(channelId)]
    if (!cfg || !lat) return false
    return lat.value > cfg.upper_threshold || lat.value < cfg.lower_threshold
  }

  const allTimestamps = [...new Set(measurements.map(m => m.timestamp))].sort((a, b) => b.localeCompare(a))
  const pagedTimestamps = allTimestamps.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(allTimestamps.length / pageSize)

  const measureMap: Record<string, Record<number, number>> = {}
  for (const m of measurements) {
    if (!measureMap[m.timestamp]) measureMap[m.timestamp] = {}
    measureMap[m.timestamp][m.sensor_channel_id] = m.value
  }

  const graphTimestamps = allTimestamps.slice(0, 24).reverse()

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

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {sensors.map(sensor =>
          sensor.channels.map(ch => {
            const lat = latest[String(ch.id)]
            const cfg = getConfig(ch.id)
            const danger = isChannelDanger(ch.id)
            return (
              <ValueCard
                key={ch.id}
                label={`${sensor.name} ${ch.name}`}
                value={lat?.value}
                unit={ch.unit}
                upper={cfg?.upper_threshold}
                lower={cfg?.lower_threshold}
                danger={danger}
              />
            )
          })
        )}
      </div>

      {sensors.map(sensor => (
        <div key={sensor.id} style={{ marginBottom: '2rem' }}>
          <h2>{sensor.name} 推移（直近24件）</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={graphTimestamps.map(ts => {
                const row: Record<string, string | number | null> = { time: formatTimestamp(ts).slice(5) }
                for (const ch of sensor.channels) row[ch.name] = measureMap[ts]?.[ch.id] ?? null
                return row
              })}
              margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit={sensor.channels[0]?.unit} />
              <Tooltip formatter={(v, name) => [`${v}${sensor.channels.find(c => c.name === name)?.unit ?? ''}`, name]} />
              <Legend />
              {sensor.channels.flatMap((ch, i) => {
                const cfg = getConfig(ch.id)
                const color = LINE_COLORS[i % LINE_COLORS.length]
                return [
                  cfg ? <ReferenceLine key={`u${ch.id}`} y={cfg.upper_threshold} stroke={color} strokeDasharray="4 2" /> : null,
                  cfg ? <ReferenceLine key={`l${ch.id}`} y={cfg.lower_threshold} stroke={color} strokeDasharray="4 2" /> : null,
                  <Line key={ch.id} type="monotone" dataKey={ch.name} stroke={color} dot={false} strokeWidth={2} connectNulls />,
                ]
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>計測データ一覧</h2>
        <label style={{ fontSize: '0.9rem', color: '#64748b' }}>
          表示件数：
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ marginLeft: '0.25rem' }}>
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}件</option>)}
          </select>
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', color: '#64748b' }}>センサ：</label>
          <select id="csv-sensor" style={{ fontSize: '0.85rem' }}>
            <option value="">全て</option>
            {sensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label style={{ fontSize: '0.85rem', color: '#64748b' }}>期間：</label>
          <input type="date" id="csv-from" style={{ fontSize: '0.85rem' }} />
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>〜</span>
          <input type="date" id="csv-to" style={{ fontSize: '0.85rem' }} />
          <button
            onClick={() => {
              const from = (document.getElementById('csv-from') as HTMLInputElement).value
              const to = (document.getElementById('csv-to') as HTMLInputElement).value
              const sensorId = (document.getElementById('csv-sensor') as HTMLSelectElement).value
              const params = new URLSearchParams()
              if (sensorId) params.append('sensor_id', sensorId)
              if (from) params.append('date_from', from)
              if (to) params.append('date_to', to)
              const token = localStorage.getItem('token')
              fetch(`/api/measurements/export?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
                .then(res => res.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'measurements.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                })
            }}
            style={{ fontSize: '0.85rem' }}
          >
            CSVダウンロード
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.5rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>タイムスタンプ</th>
              {sensors.map(s => s.channels.map(ch => (
                <th key={ch.id} style={thStyle}>{s.name} {ch.name}（{ch.unit}）</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {pagedTimestamps.map(ts => (
              <tr key={ts}>
                <td style={tdStyle}>{formatTimestamp(ts)}</td>
                {sensors.map(s => s.channels.map(ch => (
                  <td key={ch.id} style={tdStyle}>
                    {measureMap[ts]?.[ch.id] != null ? `${measureMap[ts][ch.id]}${ch.unit}` : '—'}
                  </td>
                )))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>＜</button>
          <span style={{ fontSize: '0.9rem' }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>＞</button>
        </div>
      )}
    </div>
  )
}

function ValueCard({ label, value, unit, upper, lower, danger }: {
  label: string; value: number | undefined; unit: string
  upper: number | undefined; lower: number | undefined; danger: boolean
}) {
  const bg = danger ? '#fef2f2' : '#f0fdf4'
  const color = danger ? '#ef4444' : '#16a34a'
  return (
    <div style={{ background: bg, border: `2px solid ${color}`, borderRadius: '8px', padding: '1rem 1.5rem', minWidth: '180px', flex: '1 1 180px', maxWidth: '260px' }}>
      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color, lineHeight: 1.1 }}>
        {value != null ? `${value}${unit}` : '—'}
      </div>
      {upper != null && lower != null && (
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.4rem' }}>
          範囲：{lower}{unit}〜{upper}{unit}
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '0.5rem', background: '#f1f5f9', textAlign: 'left' }
const tdStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '0.5rem' }

export default Dashboard
