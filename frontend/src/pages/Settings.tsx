import { useEffect, useState } from 'react'
import axios from 'axios'

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

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      window.location.href = '/login'
      return
    }
    const headers = { Authorization: `Bearer ${token}` }
    axios.get('/api/settings', { headers }).then(res => setSettings(res.data))
  }, [])

  const handleUpdate = async (s: Settings) => {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    await axios.put(`/api/settings/${s.channel}`, s, { headers })
    alert('更新しました')
  }

  return (
    <div>
      <h1>閾値設定</h1>
      {settings.map(s => (
        <div key={s.channel}>
          <h2>CH{s.channel}</h2>
          <label>上限閾値</label>
          <input type="number" value={s.upper_threshold} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, upper_threshold: Number(e.target.value) } : x))} />
          <label>下限閾値</label>
          <input type="number" value={s.lower_threshold} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, lower_threshold: Number(e.target.value) } : x))} />
          <label>傾き閾値</label>
          <input type="number" value={s.slope_threshold} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, slope_threshold: Number(e.target.value) } : x))} />
          <label>回帰データ数</label>
          <input type="number" value={s.regression_count} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, regression_count: Number(e.target.value) } : x))} />
          <label>傾向監視</label>
          <input type="checkbox" checked={s.trend_monitor} onChange={e => setSettings(settings.map(x => x.channel === s.channel ? { ...x, trend_monitor: e.target.checked } : x))} />
          <button onClick={() => handleUpdate(s)}>更新</button>
        </div>
      ))}
    </div>
  )
}

export default Settings