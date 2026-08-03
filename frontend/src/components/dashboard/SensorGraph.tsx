import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { Sensor, Measurement, ChannelConfig } from '../../types/dashboard'

const STROKE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']
const FILL_COLORS = [
  'rgba(59,130,246,0.12)', 'rgba(245,158,11,0.12)', 'rgba(16,185,129,0.12)',
  'rgba(239,68,68,0.12)', 'rgba(139,92,246,0.12)', 'rgba(236,72,153,0.12)',
]

function fmtTick(ts: string, hours: number): string {
  const d = new Date(ts.replace(' ', 'T'))
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  if (hours <= 24) return `${h}:${m}`
  if (hours <= 72) return `${mo}/${day} ${h}:${m}`
  return `${mo}/${day}`
}

function fmtTooltip(ts: string): string {
  const d = new Date(ts.replace(' ', 'T'))
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${mo}/${day} ${h}:${m}`
}

interface Props {
  sensor: Sensor
  graphMeasurements: Measurement[]
  getConfig: (channelId: number) => ChannelConfig | undefined
  scopeHours: number
}

export function SensorGraph({ sensor, graphMeasurements, getConfig, scopeHours }: Props) {
  const sensorChannelIds = new Set(sensor.channels.map(ch => ch.id))
  const sensorTimestamps = [...new Set(
    graphMeasurements
      .filter(m => sensorChannelIds.has(m.sensor_channel_id))
      .map(m => m.timestamp)
  )].sort()

  const chValueMap: Record<number, Record<string, number>> = {}
  for (const m of graphMeasurements) {
    if (!sensorChannelIds.has(m.sensor_channel_id)) continue
    if (!chValueMap[m.sensor_channel_id]) chValueMap[m.sensor_channel_id] = {}
    chValueMap[m.sensor_channel_id][m.timestamp] = m.value
  }

  const chartData = sensorTimestamps.map(ts => {
    const pt: Record<string, string | number | null> = { ts }
    for (const ch of sensor.channels) pt[ch.name] = chValueMap[ch.id]?.[ts] ?? null
    return pt
  })

  const interval = sensorTimestamps.length > 16 ? Math.floor(sensorTimestamps.length / 12) : 0
  const units    = [...new Set(sensor.channels.map(ch => ch.unit))]
  const axisId   = (unit: string) => units.indexOf(unit) === 0 ? 'L' : 'R'
  const biAxial  = units.length > 1

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
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
        {sensor.name}
      </div>
      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'stretch' }}>

        <div style={{ flex: 1, minWidth: 0, paddingTop: '0.75rem' }}>
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={chartData} margin={{ top: 4, right: biAxial ? 8 : 4, left: 0, bottom: 46 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e8edf3" />
              <XAxis
                dataKey="ts"
                tickFormatter={(ts) => fmtTick(String(ts), scopeHours)}
                tick={{ fontSize: 9, fill: '#94a3b8', angle: -45, textAnchor: 'end' }}
                interval={interval}
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
                labelFormatter={(label: unknown) => fmtTooltip(String(label))}
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
}
