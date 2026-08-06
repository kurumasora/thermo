import { useEffect, useState, useCallback, useMemo } from 'react'
import { getSensors } from '../api/sensors'
import { getMeasurements, getLatestMeasurements } from '../api/measurements'
import { getSettings } from '../api/settings'
import { ValueCard } from '../components/dashboard/ValueCard'
import { GraphControls } from '../components/dashboard/GraphControls'
import { SensorGraph } from '../components/dashboard/SensorGraph'
import { MeasurementTable } from '../components/dashboard/MeasurementTable'
import type { Sensor, Measurement, LatestEntry, ChannelConfig } from '../types/dashboard'

const POLL_INTERVAL_MS = 10 * 60 * 1000

const SCOPES = [
  { label: '1時間',  hours: 1 },
  { label: '12時間', hours: 12 },
  { label: '24時間', hours: 24 },
  { label: '3日',    hours: 72 },
  { label: '7日',    hours: 168 },
  { label: '30日',   hours: 720 },
]

// DB のタイムスタンプはローカル時刻（JST, タイムゾーン情報なし）で保存されているため
// API に渡す日時もローカル時刻文字列に合わせる
function toLocalStr(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

function Dashboard() {
  const [sensors, setSensors]         = useState<Sensor[]>([])
  const [latest, setLatest]           = useState<Record<string, LatestEntry>>({})
  const [configs, setConfigs]         = useState<ChannelConfig[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)


  const [graphMeasurements, setGraphMeasurements] = useState<Measurement[]>([])
  const [tableMeasurements, setTableMeasurements] = useState<Measurement[]>([])
  const [scopeIdx, setScopeIdx]   = useState(1)
  const [offset, setOffset]       = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const [calMode, setCalMode]     = useState(false)
  const [calFrom, setCalFrom]     = useState('')
  const [calTo, setCalTo]         = useState('')

  const scopeMs = SCOPES[scopeIdx].hours * 3600_000
  const endMs   = Date.now() - offset * scopeMs
  const startMs = endMs - scopeMs

  const fetchCommon = useCallback(() => {
    Promise.all([
      getSensors(),
      getLatestMeasurements(),
      getSettings(),
      getMeasurements({}),
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

  useEffect(() => {
    if (calMode) {
      if (!calFrom || !calTo) return
      getMeasurements({ date_from: calFrom.replace('T', ' '), date_to: calTo.replace('T', ' ') })
        .then(res => setGraphMeasurements(res.data))
    } else {
      const sMs     = SCOPES[scopeIdx].hours * 3600_000
      const endDate = new Date(Date.now() - offset * sMs)
      const startDate = new Date(endDate.getTime() - sMs)
      getMeasurements({ date_from: toLocalStr(startDate), date_to: toLocalStr(endDate) })
        .then(res => setGraphMeasurements(res.data))
    }
  }, [scopeIdx, offset, refreshTick, calMode, calFrom, calTo])

  useEffect(() => {
    if (calMode || offset !== 0) return
    const id = setInterval(() => setRefreshTick(t => t + 1), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [offset, calMode])

  const getConfig = (channelId: number) => configs.find(c => c.sensor_channel_id === channelId)

  const isChannelDanger = (channelId: number) => {
    const cfg = getConfig(channelId)
    const lat = latest[String(channelId)]
    if (!cfg || !lat) return false
    return lat.value > cfg.upper_threshold || lat.value < cfg.lower_threshold
  }

  const anyDanger = sensors.some(s => s.channels.some(ch => isChannelDanger(ch.id)))

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

  const handleCsvDownload = () => {
    const token = localStorage.getItem('token')
    fetch('/api/measurements/export', {
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

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '1.75rem 2rem' }}>

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {sensors.map(sensor => (
          <div key={sensor.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${sensor.channels.length}, 1fr)`, gap: '0.75rem' }}>
            {sensor.channels.map(ch => (
              <ValueCard
                key={ch.id}
                sensorName={sensor.name}
                channelName={ch.name}
                value={latest[String(ch.id)]?.value}
                unit={ch.unit}
                upper={getConfig(ch.id)?.upper_threshold}
                lower={getConfig(ch.id)?.lower_threshold}
                danger={isChannelDanger(ch.id)}
                timestamp={latest[String(ch.id)]?.timestamp}
              />
            ))}
          </div>
        ))}
      </div>

      {/* グラフコントロール */}
      <GraphControls
        calMode={calMode} setCalMode={setCalMode}
        calFrom={calFrom} setCalFrom={setCalFrom}
        calTo={calTo} setCalTo={setCalTo}
        scopeIdx={scopeIdx} setScopeIdx={setScopeIdx}
        offset={offset} setOffset={setOffset}
        scopes={SCOPES}
        startMs={startMs} endMs={endMs}
      />

      {/* センサグラフ */}
      <div id="graph" style={{ scrollMarginTop: '1rem' }} />
      {sensors.map(sensor => (
        <SensorGraph
          key={sensor.id}
          sensor={sensor}
          graphMeasurements={graphMeasurements}
          getConfig={getConfig}
          scopeHours={calMode ? 168 : SCOPES[scopeIdx].hours}
          startMs={startMs}
          endMs={endMs}
        />
      ))}

      {/* 計測データテーブル */}
      <div id="table" style={{ scrollMarginTop: '1rem' }} />
      <MeasurementTable
        sensors={sensors}
        tableMeasureMap={tableMeasureMap}
        allTimestamps={allTimestamps}
        getConfig={getConfig}
        onCsvDownload={handleCsvDownload}
      />
    </div>
  )
}

export default Dashboard
