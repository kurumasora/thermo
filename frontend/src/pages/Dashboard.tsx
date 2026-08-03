import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import client from '../api/client'

type SensorChannel = { id: number; channel_no: number; name: string; unit: string }
type Sensor = { id: number; sensor_key: string; name: string; active: boolean; channels: SensorChannel[] }
type Measurement = { id: number; timestamp: string; sensor_channel_id: number; value: number }
type ChannelConfig = { sensor_channel_id: number; upper_threshold: number; lower_threshold: number; sensor_id: number }

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

export default function Dashboard() {
  const [sensors, setSensors]         = useState<Sensor[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [configs, setConfigs]         = useState<ChannelConfig[]>([])
  const [scopeIdx, setScopeIdx]       = useState(1) // 12時間
  const [offset, setOffset]           = useState(0) // 0 = 最新
  const [refreshTick, setRefreshTick] = useState(0)

  const scopeMs = SCOPES[scopeIdx].hours * 3600_000

  // データ取得
  useEffect(() => {
    const endDate   = new Date(Date.now() - offset * scopeMs)
    const startDate = new Date(endDate.getTime() - scopeMs)

    Promise.all([
      client.get('/api/sensors'),
      client.get('/api/measurements', {
        params: {
          date_from: startDate.toISOString(),
          date_to:   endDate.toISOString(),
        },
      }),
      client.get('/api/settings'),
    ]).then(([sRes, mRes, cRes]) => {
      setSensors(sRes.data.filter((s: Sensor) => s.active))
      setMeasurements(mRes.data)
      setConfigs(cRes.data)
    })
  }, [scopeIdx, offset, refreshTick, scopeMs])

  // 最新表示中のみ10分ごとに自動更新
  useEffect(() => {
    if (offset !== 0) return
    const id = setInterval(() => setRefreshTick(t => t + 1), 10 * 60_000)
    return () => clearInterval(id)
  }, [offset])

  // 表示範囲（レンダリング時刻基準）
  const endMs   = Date.now() - offset * scopeMs
  const startMs = endMs - scopeMs

  const measureMap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {}
    for (const m of measurements) {
      if (!map[m.timestamp]) map[m.timestamp] = {}
      map[m.timestamp][m.sensor_channel_id] = m.value
    }
    return map
  }, [measurements])

  const timestamps = useMemo(
    () => [...new Set(measurements.map(m => m.timestamp))].sort(),
    [measurements],
  )

  const getConfig = (channelId: number) =>
    configs.find(c => c.sensor_channel_id === channelId)

  // X軸: データ点数に応じてラベル間隔を調整（目安12本）
  const xInterval = timestamps.length > 16 ? Math.floor(timestamps.length / 12) : 0

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '1.5rem 2rem' }}>

      {/* ─── コントロールバー ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
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

      {/* ─── センサごとのグラフ行 ─── */}
      {sensors.map(sensor => {
        // チャンネルごとのデータ列を構築
        const chartData = timestamps.map(ts => {
          const pt: Record<string, string | number | null> = { ts }
          for (const ch of sensor.channels) pt[ch.name] = measureMap[ts]?.[ch.id] ?? null
          return pt
        })

        // 単位ごとにY軸を割り当て（混在する場合は左右2軸）
        const units   = [...new Set(sensor.channels.map(ch => ch.unit))]
        const axisId  = (unit: string) => units.indexOf(unit) === 0 ? 'L' : 'R'
        const biAxial = units.length > 1

        // チャンネルごとの統計（表示期間内の最大・平均）
        const stats = sensor.channels.map((ch, i) => {
          const vals = chartData
            .map(p => p[ch.name])
            .filter((v): v is number => typeof v === 'number')
          return {
            ch,
            color: STROKE_COLORS[i % STROKE_COLORS.length],
            fill:  FILL_COLORS[i % FILL_COLORS.length],
            max:   vals.length ? Math.max(...vals) : null,
            avg:   vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
          }
        })

        return (
          <div key={sensor.id} style={{ marginBottom: '1.25rem' }}>
            {/* センサ名ラベル */}
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
                    {/* 閾値ライン */}
                    {stats.flatMap(({ ch, color }) => {
                      const cfg = getConfig(ch.id)
                      if (!cfg) return []
                      const aid = axisId(ch.unit)
                      return [
                        <ReferenceLine key={`u${ch.id}`} yAxisId={aid} y={cfg.upper_threshold} stroke={color} strokeDasharray="4 2" strokeOpacity={0.4} />,
                        <ReferenceLine key={`l${ch.id}`} yAxisId={aid} y={cfg.lower_threshold} stroke={color} strokeDasharray="4 2" strokeOpacity={0.4} />,
                      ]
                    })}
                    {/* 面グラフ */}
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

              {/* ─── 右パネル: 凡例 + 統計 ─── */}
              <div style={{
                width: '128px', flexShrink: 0,
                borderLeft: '1px solid #f1f5f9',
                padding: '0.9rem 0.9rem 0.9rem 0.75rem',
                display: 'flex', flexDirection: 'column', gap: '0.8rem', justifyContent: 'center',
              }}>
                {stats.map(({ ch, color, max, avg }) => (
                  <div key={ch.id} style={{ fontSize: '0.75rem' }}>
                    {/* チャンネル名 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                      <span style={{
                        width: '9px', height: '9px', background: color,
                        borderRadius: '2px', display: 'inline-block', flexShrink: 0,
                      }} />
                      <span style={{ fontWeight: 600, color: '#334155' }}>{ch.name}</span>
                    </div>
                    {/* Max / Avg */}
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

    </div>
  )
}

// ─── スタイル定数 ─────────────────────────────────────────────────────────────

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
