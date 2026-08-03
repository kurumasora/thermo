import { useState, useMemo } from 'react'
import { formatTimestamp } from '../../utils/format'
import type { Sensor, ChannelConfig } from '../../types/dashboard'

const PAGE_SIZE_OPTIONS = [20, 50, 100]

interface Props {
  sensors: Sensor[]
  tableMeasureMap: Record<string, Record<number, number>>
  allTimestamps: string[]
  getConfig: (channelId: number) => ChannelConfig | undefined
  onCsvDownload: () => void
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
const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}
const filterInputStyle: React.CSSProperties = {
  fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #e2e8f0',
  padding: '0.25rem 0.5rem', color: '#475569',
}

export function MeasurementTable({
  sensors, tableMeasureMap, allTimestamps, getConfig, onCsvDownload,
}: Props) {
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filterSensor, setFilterSensor] = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')

  const filteredTimestamps = useMemo(() => {
    return allTimestamps.filter(ts => {
      if (filterFrom && ts < filterFrom.replace('T', ' ')) return false
      if (filterTo   && ts > filterTo.replace('T', ' ') + ' 99') return false
      if (filterSensor) {
        const sensor = sensors.find(s => String(s.id) === filterSensor)
        if (!sensor) return false
        const hasData = sensor.channels.some(ch => tableMeasureMap[ts]?.[ch.id] != null)
        if (!hasData) return false
      }
      return true
    })
  }, [allTimestamps, filterFrom, filterTo, filterSensor, sensors, tableMeasureMap])

  const totalPages      = Math.ceil(filteredTimestamps.length / pageSize)
  const pagedTimestamps = filteredTimestamps.slice((page - 1) * pageSize, page * pageSize)

  const visibleSensors = filterSensor
    ? sensors.filter(s => String(s.id) === filterSensor)
    : sensors

  const handleFilterChange = (fn: () => void) => { fn(); setPage(1) }

  return (
    <div style={{ ...cardStyle, marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>計測データ一覧</h2>
        <label style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '0.5rem' }}>
          表示件数：
          <select value={pageSize} onChange={e => handleFilterChange(() => setPageSize(Number(e.target.value)))}
            style={{ marginLeft: '0.25rem', fontSize: '0.82rem', borderRadius: '4px', border: '1px solid #e2e8f0', padding: '0.1rem 0.3rem' }}>
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}件</option>)}
          </select>
        </label>

        <select value={filterSensor} onChange={e => handleFilterChange(() => setFilterSensor(e.target.value))} style={filterInputStyle}>
          <option value="">全センサ</option>
          {sensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={filterFrom} onChange={e => handleFilterChange(() => setFilterFrom(e.target.value))} style={filterInputStyle} />
        <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>〜</span>
        <input type="date" value={filterTo} onChange={e => handleFilterChange(() => setFilterTo(e.target.value))} style={filterInputStyle} />

        <button onClick={onCsvDownload} style={{
          marginLeft: 'auto', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #e2e8f0',
          padding: '0.25rem 0.75rem', background: '#f8fafc', color: '#475569', cursor: 'pointer',
        }}>CSVダウンロード</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.83rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>タイムスタンプ</th>
              {visibleSensors.map(s => s.channels.map(ch => (
                <th key={ch.id} style={thStyle}>{s.name} {ch.name}（{ch.unit}）</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {pagedTimestamps.map((ts, i) => (
              <tr key={ts} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={tdStyle}>{formatTimestamp(ts)}</td>
                {visibleSensors.map(s => s.channels.map(ch => {
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
  )
}
