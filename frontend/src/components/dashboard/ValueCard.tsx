import { formatTimestamp } from '../../utils/format'

interface Props {
  sensorName: string
  channelName: string
  value: number | undefined
  unit: string
  upper: number | undefined
  lower: number | undefined
  danger: boolean
  timestamp: string | undefined
}

export function ValueCard({ sensorName, channelName, value, unit, upper, lower, danger, timestamp }: Props) {
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
