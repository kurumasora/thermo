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
const LINE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

function Dashboard() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [latest, setLatest] = useState<Record<string, LatestEntry>>({})
  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [csvSensorId, setCsvSensorId] = useState('')
  const [csvFrom, setCsvFrom] = useState('')
  const [csvTo, setCsvTo] = useState('')

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

  const handleCsvDownload = () => {
    const params = new URLSearchParams()
    if (csvSensorId) params.append('sensor_id', csvSensorId)
    if (csvFrom) params.append('date_from', csvFrom)
    if (csvTo) params.append('date_to', csvTo)
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
  }

  const isChannelDanger = (channelId: number): boolean => {
    const cfg = getConfig(channelId)
    const lat = latest[String(channelId)]
    if (!cfg || !lat) return false
    return lat.value > cfg.upper_threshold || lat.value < cfg.lower_threshold
  }

  const anyDanger = sensors.some(s => s.channels.some(ch => isChannelDanger(ch.id)))

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
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '1.75rem 2rem' }}>

      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 400, color: '#0f172a', margin: 0 }}>ダッシュボード</h1>
          {lastUpdated && (
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              最終更新：{lastUpdated.toLocaleTimeString('ja-JP')}
            </p>
          )}
        </div>
        {anyDanger && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: '8px', padding: '0.5rem 1rem',
            fontSize: '0.85rem', color: '#dc2626', fontWeight: 600,
          }}>
            ⚠ 異常値を検出しています
          </div>
        )}
      </div>

      {/* センサごとに現在値カード＋グラフをまとめたカラムレイアウト */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sensors.length || 1}, 1fr)`, gap: '1rem', marginBottom: '1.5rem' }}>
        {sensors.map(sensor => (
          <div key={sensor.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* 現在値カード群 */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sensor.channels.length}, 1fr)`, gap: '0.75rem' }}>
              {sensor.channels.map(ch => {
                const lat = latest[String(ch.id)]
                const cfg = getConfig(ch.id)
                const danger = isChannelDanger(ch.id)
                return (
                  <ValueCard
                    key={ch.id}
                    sensorName={sensor.name}
                    channelName={ch.name}
                    value={lat?.value}
                    unit={ch.unit}
                    upper={cfg?.upper_threshold}
                    lower={cfg?.lower_threshold}
                    danger={danger}
                    timestamp={lat?.timestamp}
                  />
                )
              })}
            </div>

            {/* グラフ */}
            <div style={{ ...cardStyle, flex: 1 }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                  {sensor.name} <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.8rem' }}>直近24件の推移</span>
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={graphTimestamps.map(ts => {
                    const row: Record<string, string | number | null> = { time: formatTimestamp(ts).slice(5) }
                    for (const ch of sensor.channels) row[ch.name] = measureMap[ts]?.[ch.id] ?? null
                    return row
                  })}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} unit={sensor.channels[0]?.unit} width={48} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem' }}
                    formatter={(v, name) => [`${v}${sensor.channels.find(c => c.name === name)?.unit ?? ''}`, name]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.8rem' }} />
                  {sensor.channels.flatMap((ch, i) => {
                    const cfg = getConfig(ch.id)
                    const color = LINE_COLORS[i % LINE_COLORS.length]
                    return [
                      cfg ? <ReferenceLine key={`u${ch.id}`} y={cfg.upper_threshold} stroke={color} strokeDasharray="4 2" strokeOpacity={0.5} /> : null,
                      cfg ? <ReferenceLine key={`l${ch.id}`} y={cfg.lower_threshold} stroke={color} strokeDasharray="4 2" strokeOpacity={0.5} /> : null,
                      <Line key={ch.id} type="monotone" dataKey={ch.name} stroke={color} dot={false} strokeWidth={2} connectNulls />,
                    ]
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>

          </div>
        ))}
      </div>

      {/* 計測データテーブル */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>計測データ一覧</h2>
          <label style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '0.5rem' }}>
            表示件数：
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              style={{ marginLeft: '0.25rem', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid #e2e8f0', padding: '0.1rem 0.3rem' }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}件</option>)}
            </select>
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select value={csvSensorId} onChange={e => setCsvSensorId(e.target.value)} style={inputStyle}>
              <option value="">全センサ</option>
              {sensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={csvFrom} onChange={e => setCsvFrom(e.target.value)} style={inputStyle} />
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>〜</span>
            <input type="date" value={csvTo} onChange={e => setCsvTo(e.target.value)} style={inputStyle} />
            <button onClick={handleCsvDownload} style={csvBtnStyle}>CSVダウンロード</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <th style={thStyle}>タイムスタンプ</th>
                {sensors.map(s => s.channels.map(ch => (
                  <th key={ch.id} style={thStyle}>{s.name} {ch.name}（{ch.unit}）</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {pagedTimestamps.map((ts, i) => (
                <tr key={ts} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={tdStyle}>{formatTimestamp(ts)}</td>
                  {sensors.map(s => s.channels.map(ch => {
                    const val = measureMap[ts]?.[ch.id]
                    const cfg = getConfig(ch.id)
                    const outOfRange = val != null && cfg && (val > cfg.upper_threshold || val < cfg.lower_threshold)
                    return (
                      <td key={ch.id} style={{ ...tdStyle, color: outOfRange ? '#ef4444' : undefined, fontWeight: outOfRange ? 600 : undefined }}>
                        {val != null ? `${val}${ch.unit}` : '—'}
                      </td>
                    )
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={pageBtnStyle}>‹</button>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} style={pageBtnStyle}>›</button>
          </div>
        )}
      </div>
    </div>
  )
}


function ValueCard({ sensorName, channelName, value, unit, upper, lower, danger, timestamp }: {
  sensorName: string; channelName: string; value: number | undefined; unit: string
  upper: number | undefined; lower: number | undefined; danger: boolean; timestamp: string | undefined
}) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      boxShadow: danger ? '0 0 0 2px #ef4444' : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: '0.25rem',
    }}>
      <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em' }}>
        {sensorName}
      </div>
      <div style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 500 }}>{channelName}</div>
      <div style={{ fontSize: '2.4rem', fontWeight: 700, color: danger ? '#ef4444' : '#0f172a', lineHeight: 1.1, margin: '0.4rem 0' }}>
        {value != null ? value : '—'}
        <span style={{ fontSize: '1rem', fontWeight: 500, color: danger ? '#ef4444' : '#64748b', marginLeft: '0.2rem' }}>{unit}</span>
      </div>
      {upper != null && lower != null && (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          範囲：{lower}{unit} 〜 {upper}{unit}
        </div>
      )}
      {timestamp && (
        <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
          {formatTimestamp(timestamp)}
        </div>
      )}
      {danger && (
        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, marginTop: '0.2rem' }}>
          ⚠ 閾値超過
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
}

const inputStyle: React.CSSProperties = {
  fontSize: '0.82rem', borderRadius: '6px',
  border: '1px solid #e2e8f0', padding: '0.25rem 0.5rem',
  color: '#475569',
}

const csvBtnStyle: React.CSSProperties = {
  fontSize: '0.82rem', borderRadius: '6px',
  border: '1px solid #e2e8f0', padding: '0.25rem 0.75rem',
  background: '#f8fafc', color: '#475569', cursor: 'pointer',
}

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', background: '#f8fafc',
  textAlign: 'left', color: '#64748b', fontWeight: 600,
  borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid #f1f5f9',
  color: '#334155', whiteSpace: 'nowrap',
}

const pageBtnStyle: React.CSSProperties = {
  padding: '0.2rem 0.6rem', borderRadius: '4px',
  border: '1px solid #e2e8f0', background: '#fff',
  cursor: 'pointer', fontSize: '0.9rem', color: '#475569',
}

export default Dashboard
