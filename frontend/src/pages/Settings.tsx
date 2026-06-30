import { useEffect, useState } from 'react'
import client from '../api/client'

type Settings = {
  id: number
  channel: number
  upper_threshold: number
  lower_threshold: number
  slope_threshold: number
  regression_count: number
  trend_monitor: boolean
}

function Settings() {
  const [settings, setSettings] = useState<Settings[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    client.get('/api/settings').then(res => setSettings(res.data))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleUpdate = async (s: Settings) => {
    await client.put(`/api/settings/${s.channel}`, s)
    showToast(`CH${s.channel} の設定を更新しました`)
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>閾値設定</h1>

      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: '#22c55e', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000,
          fontSize: '0.9rem',
        }}>
          {toast}
        </div>
      )}

      {settings.map(s => (
        <div key={s.channel} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <h2 style={{ marginTop: 0 }}>CH{s.channel}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center', maxWidth: '400px' }}>
            <label>上限閾値 (℃)</label>
            <input type="number" value={s.upper_threshold} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, upper_threshold: Number(e.target.value) } : x))} />
            <label>下限閾値 (℃)</label>
            <input type="number" value={s.lower_threshold} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, lower_threshold: Number(e.target.value) } : x))} />
            <label>傾き閾値 (℃/step)</label>
            <input type="number" value={s.slope_threshold} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, slope_threshold: Number(e.target.value) } : x))} />
            <label>回帰データ数</label>
            <input type="number" value={s.regression_count} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, regression_count: Number(e.target.value) } : x))} />
            <label>傾向監視</label>
            <input type="checkbox" checked={s.trend_monitor} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, trend_monitor: e.target.checked } : x))} />
          </div>
          <button onClick={() => handleUpdate(s)} style={{ marginTop: '0.75rem' }}>更新</button>
        </div>
      ))}
    </div>
  )
}

export default Settings
