import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
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
const STROKE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']
const FILL_COLORS = [
  'rgba(59,130,246,0.12)', 'rgba(245,158,11,0.12)', 'rgba(16,185,129,0.12)',
  'rgba(239,68,68,0.12)', 'rgba(139,92,246,0.12)', 'rgba(236,72,153,0.12)',
]

const SCOPES = [
  { label: '1時間',  hours: 1 },
  { label: '12時間', hours: 12 },
  { label: '24時間', hours: 24 },
  { label: '3日',    hours: 72 },
  { label: '7日',    hours: 168 },
  { label: '30日',   hours: 720 },
]

function fmtTick(ts: string): string {
  const d = new Date(ts)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const h12 = h % 12 || 12
  return `${h12}:${m} ${h < 12 ? 'am' : 'pm'}`
}

function fmtRange(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  )
}

function Dashboard() {
  // ─── 現在値カード・テーブル用 state ───────────────────────────────────────
  const [sensors, setSensors]           = useState<Sensor[]>([])
  const [latest, setLatest]             = useState<Record<string, LatestEntry>>({})
  const [configs, setConfigs]           = useState<ChannelConfig[]>([])
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null)
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(20)
  const [csvSensorId, setCsvSensorId]   = useState('')
  const [csvFrom, setCsvFrom]           = useState('')
  const [csvTo, setCsvTo]               = useState('')

  // ─── グラフ用 state ────────────────────────────────────────────────────────
  const [graphMeasurements, setGraphMeasurements] = useState<Measurement[]>([])
  const [tableMeasurements, setTableMeasurements] = useState<Measurement[]>([])
  const [scopeIdx, setScopeIdx]         = useState(1) // 12時間
  const [offset, setOffset]             = useState(0) // 0 = 最新
  const [refreshTick, setRefreshTick]   = useState(0)

  const scopeMs = SCOPES[scopeIdx].hours * 3600_000

  // 共通データ（センサ一覧・最新値・設定）を10分ごとにポーリング
  const fetchCommon = useCallback(() => {
    Promise.all([
      client.get('/api/sensors'),
      client.get('/api/measurements/latest'),
      client.get('/api/settings'),
      client.get('/api/measurements'), // テーブル用（直近500件）
    ]).then(([sRes, lRes, cRes, mRes]) => {
      setSensors(sRes.data.filter((s: Sensor) => s.active))
      setLatest(lRes.data)
      setConfigs(cRes.data)
      setTableMeasurements(mRes.data)
      setLastUpdated(new Date())
    })
  }, [])

  useEffect(() => {
    fetchCommon()
    const timer = setInterval(fetchCommon, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchCommon])

  // グラフデータをスコープ・オフセット変化時に取得
  useEffect(() => {
    const endDate   = new Date(Date.now() - offset * scopeMs)
    const startDate = new Date(endDate.getTime() - scopeMs)
    client.get('/api/measurements', {
      params: {
        date_from: startDate.toISOString(),
        date_to:   endDate.toISOString(),
      },
    }).then(res => setGraphMeasurements(res.data))
  }, [scopeIdx, offset, refreshTick, scopeMs])

  // 最新表示中のみ10分ごとにグラフも自動更新
  useEffect(() => {
    if (offset !== 0) return
    const id = setInterval(() => setRefreshTick(t => t + 1), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [offset])

  // ─── 共通ヘルパー ─────────────────────────────────────────────────────────
  const getConfig = (channelId: number) => configs.find(c => c.sensor_channel_id === channelId)

  const isChannelDanger = (channelId: number): boolean => {
    const cfg = getConfig(channelId)
    const lat = latest[String(channelId)]
    if (!cfg || !lat) return false
    return lat.value > cfg.upper_threshold || lat.value < cfg.lower_threshold
  }

  const anyDanger = sensors.some(s => s.channels.some(ch => isChannelDanger(ch.id)))

  // ─── グラフ用データ ────────────────────────────────────────────────────────
  const graphMeasureMap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {}
    for (const m of graphMeasurements) {
      if (!map[m.timestamp]) map[m.timestamp] = {}
      map[m.timestamp][m.sensor_channel_id] = m.value
    }
    return map
  }, [graphMeasurements])

  const graphTimestamps = useMemo(
    () => [...new Set(graphMeasurements.map(m => m.timestamp))].sort(),
    [graphMeasurements],
  )

  const xInterval = graphTimestamps.length > 16 ? Math.floor(graphTimestamps.length / 12) : 0

  const endMs   = Date.now() - offset * scopeMs
  const startMs = endMs - scopeMs

  // ─── テーブル用データ ──────────────────────────────────────────────────────
  const tableMeasureMap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {}
    for (const m of tableMeasurements) {
      if (!map[m.timestamp]) map[m.timestamp] = {}
      map[m.timestamp][m.sensor_channel_id] = m.value
    }
    return map
  }, [tableMeasurements])

  const allTimestamps = useMemo(
    () => [...new Set(tableMeasurements.map(m => m.timestamp))].sort((a, b) => b.localeCompare(a)),
    [tableMeasurements],
  )

  const pagedTimestamps = allTimestamps.slice((page - 1) * pageSize, page * pageSize)
  const totalPages      = Math.ceil(allTimestamps.length / pageSize)

  // ─── CSV ──────────────────────────────────────────────────────────────────
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
        a.href = url; a.download = 'measurements.csv'; a.click()
        URL.revokeObjectURL(url)
      })
  }

  // ─── レンダリング ─────────────────────────────────────────────────────────
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

      {/* 現在値カード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {sensors.map(sensor => (
          <div key={sensor.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${sensor.channels.length}, 1fr)`, gap: '0.75rem' }}>
            {sensor.channels.map(ch => {
              const lat    = latest[String(ch.id)]
              const cfg    = getConfig(ch.id)
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
        ))}
      </div>

      {/* ─── グラフセクション ─────────────────────────────────────────────── */}

      {/* スコープ・ナビゲーションコントロール */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
        <select
          value={scopeIdx}
          onChange={e => { setScopeIdx(Number(e.target.value)); setOffset(0) }}
          style={ctrlSelect}
        >
          {SCOPES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
        </select>
        <button onClick={() => setOffset(o => o + 1)} style={navBtn} title="前の期間へ">‹</button>
        <button
          onClick={() => setOffset(o => Math.max(0, o - 1))}
          disabled={offset === 0}
          style={{ ...navBtn, opacity: offset === 0 ? 0.35 : 1, cursor: offset === 0 ? 'default' : 'pointer' }}
          title="次の期間へ"
        >›</button>
        <button
          onClick={() => setOffset(0)}
          disabled={offset === 0}
          style={{ ...navBtn, opacity: offset === 0 ? 0.35 : 1, cursor: offset === 0 ? 'default' : 'pointer' }}
          title="最新へ"
        >»</button>
        <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '0.3rem' }}>
          {fmtRange(startMs)} 〜 {fmtRange(endMs)}
        </span>
      </div>

      {/* センサごとのグラフ行（1センサ = 1行フル幅） */}
      {sensors.map(sensor => {
        const chartData = graphTimestamps.map(ts => {
          const pt: Record<string, string | number | null> = { ts }
          for (const ch of sensor.channels) pt[ch.name] = graphMeasureMap[ts]?.[ch.id] ?? null
          return pt
        })

        const units   = [...new Set(sensor.channels.map(ch => ch.unit))]
        const axisId  = (unit: string) => units.indexOf(unit) === 0 ? 'L' : 'R'
        const biAxial = units.length > 1

        const stats = sensor.channels.map((ch, i) => {
          const vals = chartData.map(p => p[ch.name]).filter((v): v is number => typeof v === 'number')
          return {
            ch,
            color: STROKE_COLORS[i % STROKE_COLORS.length],
            fill:  FILL_COLORS[i % FILL_COLORS.length],
            max:   vals.length ? Math.max(...vals) : null,
            avg:   vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
          }
        })

        return (
          <div key={sensor.id} style={{ marginBottom: '1rem' }}>
            <div style={sensorLabel}>{sensor.name}</div>
            <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'stretch' }}>

              {/* グラフ本体 */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: '0.75rem' }}>
                <ResponsiveContainer width="100%" height={185}>
                  <AreaChart data={chartData} margin={{ top: 4, right: biAxial ? 8 : 4, left: 0, bottom: 46 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e8edf3" />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={fmtTick}
                      tick={{ fontSize: 9, fill: '#94a3b8', angle: -45, textAnchor: 'end' }}
                      interval={xInterval}
                      height={50}
                    />
                    {units.map((unit, i) => (
                      <YAxis
                        key={unit}
                        yAxisId={axisId(unit)}
                        orientation={i === 0 ? 'left' : 'right'}
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        unit={unit}
                        width={44}
                      />
                    ))}
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem' }}
                      labelFormatter={(label: unknown) => fmtTick(String(label))}
                      formatter={(v, name) => {
                        const ch = sensor.channels.find(c => c.name === name)
                        return [typeof v === 'number' ? `${v.toFixed(1)}${ch?.unit ?? ''}` : '—', name as string]
                      }}
                    />
                    {stats.flatMap(({ ch, color }) => {
                      const cfg = getConfig(ch.id)
                      if (!cfg) return []
                      const aid = axisId(ch.unit)
                      return [
                        <ReferenceLine key={`u${ch.id}`} yAxisId={aid} y={cfg.upper_threshold} stroke={color} strokeDasharray="4 2" strokeOpacity={0.4} />,
                        <ReferenceLine key={`l${ch.id}`} yAxisId={aid} y={cfg.lower_threshold} stroke={color} strokeDasharray="4 2" strokeOpacity={0.4} />,
                      ]
                    })}
                    {stats.map(({ ch, color, fill }) => (
                      <Area
                        key={ch.id}
                        yAxisId={axisId(ch.unit)}
                        type="monotone"
                        dataKey={ch.name}
                        stroke={color}
                        fill={fill}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* 右パネル: 凡例 + Max/Avg */}
              <div style={{
                width: '128px', flexShrink: 0,
                borderLeft: '1px solid #f1f5f9',
                padding: '0.9rem 0.9rem 0.9rem 0.75rem',
                display: 'flex', flexDirection: 'column', gap: '0.8rem', justifyContent: 'center',
              }}>
                {stats.map(({ ch, color, max, avg }) => (
                  <div key={ch.id} style={{ fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                      <span style={{ width: '9px', height: '9px', background: color, borderRadius: '2px', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: '#334155' }}>{ch.name}</span>
                    </div>
                    <div style={{ paddingLeft: '13px', lineHeight: 1.75 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem' }}>
                        <span style={{ color: '#94a3b8' }}>Max</span>
                        <span style={{ color: '#334155', fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {max != null ? max.toFixed(2) : '—'} {ch.unit}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem' }}>
                        <span style={{ color: '#94a3b8' }}>Avg</span>
                        <span style={{ color: '#334155', fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {avg != null ? avg.toFixed(2) : '—'} {ch.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )
      })}

      {/* ─── 計測データテーブル ───────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginTop: '0.5rem' }}>
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
            <select value={csvSensorId} onChange={e => setCsvSensorId(e.target.value)} style={tblInputStyle}>
              <option value="">全センサ</option>
              {sensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={csvFrom} onChange={e => setCsvFrom(e.target.value)} style={tblInputStyle} />
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>〜</span>
            <input type="date" value={csvTo} onChange={e => setCsvTo(e.target.value)} style={tblInputStyle} />
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
                    const val = tableMeasureMap[ts]?.[ch.id]
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

// ─── ValueCard ───────────────────────────────────────────────────────────────

function ValueCard({ sensorName, channelName, value, unit, upper, lower, danger, timestamp }: {
  sensorName: string; channelName: string; value: number | undefined; unit: string
  upper: number | undefined; lower: number | undefined; danger: boolean; timestamp: string | undefined
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem',
      boxShadow: danger ? '0 0 0 2px #ef4444' : '0 1px 3px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: '0.25rem',
    }}>
      <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em' }}>{sensorName}</div>
      <div style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 500 }}>{channelName}</div>
      <div style={{ fontSize: '2.4rem', fontWeight: 700, color: danger ? '#ef4444' : '#0f172a', lineHeight: 1.1, margin: '0.4rem 0' }}>
        {value != null ? value : '—'}
        <span style={{ fontSize: '1rem', fontWeight: 500, color: danger ? '#ef4444' : '#64748b', marginLeft: '0.2rem' }}>{unit}</span>
      </div>
      {upper != null && lower != null && (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>範囲：{lower}{unit} 〜 {upper}{unit}</div>
      )}
      {timestamp && (
        <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{formatTimestamp(timestamp)}</div>
      )}
      {danger && (
        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, marginTop: '0.2rem' }}>⚠ 閾値超過</div>
      )}
    </div>
  )
}

// ─── スタイル定数 ─────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}
const ctrlSelect: React.CSSProperties = {
  padding: '0.3rem 0.5rem', fontSize: '0.83rem', borderRadius: '6px',
  border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer',
}
const navBtn: React.CSSProperties = {
  padding: '0.3rem 0.55rem', fontSize: '1rem', lineHeight: 1,
  borderRadius: '6px', border: '1px solid #cbd5e1',
  background: '#fff', color: '#475569', cursor: 'pointer',
}
const sensorLabel: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 700, color: '#475569',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem',
}
const tblInputStyle: React.CSSProperties = {
  fontSize: '0.82rem', borderRadius: '6px',
  border: '1px solid #e2e8f0', padding: '0.25rem 0.5rem', color: '#475569',
}
const csvBtnStyle: React.CSSProperties = {
  fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #e2e8f0',
  padding: '0.25rem 0.75rem', background: '#f8fafc', color: '#475569', cursor: 'pointer',
}
const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', background: '#f8fafc', textAlign: 'left',
  color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', color: '#334155', whiteSpace: 'nowrap',
}
const pageBtnStyle: React.CSSProperties = {
  padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0',
  background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: '#475569',
}

export default Dashboard
