import { useEffect, useState } from 'react'
import client from '../api/client'

type ChannelConfig = {
  sensor_channel_id: number
  upper_threshold: number
  lower_threshold: number
  slope_threshold: number
  regression_count: number
  trend_monitor: boolean
  channel_no: number
  channel_name: string
  unit: string
  sensor_id: number
  sensor_name: string
  sensor_key: string
}

function Settings() {
  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    client.get('/api/settings').then(res => setConfigs(res.data))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const update = (id: number, field: string, value: number | boolean) =>
    setConfigs(configs.map(c => c.sensor_channel_id === id ? { ...c, [field]: value } : c))

  const handleSave = async (c: ChannelConfig) => {
    await client.put(`/api/settings/${c.sensor_channel_id}`, {
      upper_threshold: c.upper_threshold,
      lower_threshold: c.lower_threshold,
      slope_threshold: c.slope_threshold,
      regression_count: c.regression_count,
      trend_monitor: c.trend_monitor,
    })
    showToast(`${c.sensor_name} ${c.channel_name} を更新しました`)
  }

  // センサごとにグループ化
  const grouped = configs.reduce<Record<number, { sensor_name: string; sensor_key: string; channels: ChannelConfig[] }>>(
    (acc, c) => {
      if (!acc[c.sensor_id]) acc[c.sensor_id] = { sensor_name: c.sensor_name, sensor_key: c.sensor_key, channels: [] }
      acc[c.sensor_id].channels.push(c)
      return acc
    },
    {}
  )

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>閾値設定</h1>

      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: '#22c55e', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, fontSize: '0.9rem',
        }}>
          {toast}
        </div>
      )}

      {Object.values(grouped).map(({ sensor_name, sensor_key, channels }) => (
        <div key={sensor_key} style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '0.75rem', color: '#1e293b' }}>{sensor_name}</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {channels.map(c => (
              <div key={c.sensor_channel_id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px', minWidth: '280px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{c.channel_name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center' }}>
                  <label>上限閾値 ({c.unit})</label>
                  <input type="number" value={c.upper_threshold} onChange={e => update(c.sensor_channel_id, 'upper_threshold', Number(e.target.value))} />
                  <label>下限閾値 ({c.unit})</label>
                  <input type="number" value={c.lower_threshold} onChange={e => update(c.sensor_channel_id, 'lower_threshold', Number(e.target.value))} />
                  <label>傾き閾値 ({c.unit}/10分)</label>
                  <input type="number" step="0.1" value={c.slope_threshold} onChange={e => update(c.sensor_channel_id, 'slope_threshold', Number(e.target.value))} />
                  <label>回帰データ数</label>
                  <input type="number" value={c.regression_count} onChange={e => update(c.sensor_channel_id, 'regression_count', Number(e.target.value))} />
                  <label>傾向監視</label>
                  <input type="checkbox" checked={c.trend_monitor} onChange={e => update(c.sensor_channel_id, 'trend_monitor', e.target.checked)} />
                </div>
                <button onClick={() => handleSave(c)} style={{ marginTop: '0.75rem' }}>更新</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Settings
