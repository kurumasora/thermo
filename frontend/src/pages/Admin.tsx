import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'
import client from '../api/client'
import { formatTimestamp } from '../utils/format'

interface TokenPayload {
  sub: string
}

type User = {
  id: number
  username: string
  role: string
  created_at: string
}

type SensorItem = {
  id: number
  sensor_key: string
  name: string
  active: boolean
}

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

type PredictionSummary = {
  total: number
  verified: number
  hits: number
  misses: number
  pending: number
  accuracy_pct: number | null
}

type PredictionRecord = {
  id: number
  channel_name: string
  sensor_name: string
  direction: string
  limit_value: number
  predicted_at: string
  created_at: string
  verified: boolean
  verified_at: string | null
  outcome: string | null
  alert_message: string
}

type Tab = 'sensor' | 'threshold' | 'user' | 'prediction'

const TABS: { key: Tab; label: string }[] = [
  { key: 'sensor', label: 'センサ管理' },
  { key: 'threshold', label: '閾値設定' },
  { key: 'user', label: 'ユーザー管理' },
  { key: 'prediction', label: '予測精度' },
]

function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) ?? 'sensor'

  const setTab = (t: Tab) => setSearchParams({ tab: t })

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>管理</h1>

      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.5rem 1.25rem',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.key ? '#3b82f6' : '#64748b',
              fontWeight: tab === t.key ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '0.95rem',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sensor' && <SensorTab />}
      {tab === 'threshold' && <ThresholdTab />}
      {tab === 'user' && <UserTab />}
      {tab === 'prediction' && <PredictionTab />}
    </div>
  )
}

function SensorTab() {
  const [sensors, setSensors] = useState<SensorItem[]>([])

  useEffect(() => {
    client.get('/api/sensors').then(res => setSensors(res.data))
  }, [])

  const handleToggle = async (id: number) => {
    const res = await client.put(`/api/admin/sensors/${id}/active`)
    setSensors(sensors.map(s => s.id === id ? { ...s, active: res.data.active } : s))
  }

  return (
    <>
      <h2 style={{ marginBottom: '0.75rem' }}>センサ管理</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>センサ名</th>
            <th style={thStyle}>センサキー</th>
            <th style={thStyle}>状態</th>
            <th style={thStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          {sensors.map(s => (
            <tr key={s.id}>
              <td style={tdStyle}>{s.name}</td>
              <td style={tdStyle}><code>{s.sensor_key}</code></td>
              <td style={tdStyle}>
                <span style={{ color: s.active ? '#16a34a' : '#64748b', fontWeight: 'bold' }}>
                  {s.active ? '有効' : '無効'}
                </span>
              </td>
              <td style={tdStyle}>
                <button onClick={() => handleToggle(s.id)}>
                  {s.active ? '無効化' : '有効化'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function ThresholdTab() {
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

  const grouped = configs.reduce<Record<number, { sensor_name: string; sensor_key: string; channels: ChannelConfig[] }>>(
    (acc, c) => {
      if (!acc[c.sensor_id]) acc[c.sensor_id] = { sensor_name: c.sensor_name, sensor_key: c.sensor_key, channels: [] }
      acc[c.sensor_id].channels.push(c)
      return acc
    },
    {}
  )

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: '#22c55e', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '6px',
          zIndex: 1000, fontSize: '0.9rem',
        }}>
          {toast}
        </div>
      )}

      <h2 style={{ marginBottom: '0.75rem' }}>閾値設定</h2>

      {Object.values(grouped).map(({ sensor_name, sensor_key, channels }) => (
        <div key={sensor_key} style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem', color: '#1e293b' }}>{sensor_name}</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {channels.map(c => (
              <div key={c.sensor_channel_id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px', minWidth: '280px' }}>
                <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{c.channel_name}</h4>
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
    </>
  )
}

function UserTab() {
  const [users, setUsers] = useState<User[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({})

  const currentUsername = (() => {
    try {
      return jwtDecode<TokenPayload>(localStorage.getItem('token') ?? '').sub
    } catch {
      return ''
    }
  })()

  const fetchUsers = async () => {
    const res = await client.get('/api/admin/users')
    setUsers(res.data)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async () => {
    if (!username || !password) return
    await client.post('/api/admin/users', { username, password, role })
    setUsername('')
    setPassword('')
    await fetchUsers()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('削除しますか？')) return
    await client.delete(`/api/admin/users/${id}`)
    setUsers(users.filter(u => u.id !== id))
  }

  const handleRoleChange = async (id: number, newRole: string) => {
    await client.put(`/api/admin/users/${id}/role`, { role: newRole })
    setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u))
  }

  const handlePasswordReset = async (id: number) => {
    const newPassword = resetPasswords[id]
    if (!newPassword) return
    await client.put(`/api/admin/users/${id}/password`, { password: newPassword })
    setResetPasswords(prev => ({ ...prev, [id]: '' }))
    alert('パスワードをリセットしました')
  }

  return (
    <>
      <h2 style={{ marginBottom: '0.75rem' }}>ユーザー追加</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <input
          placeholder="ユーザー名"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="user">一般ユーザー</option>
          <option value="admin">管理者</option>
        </select>
        <button onClick={handleCreate}>追加</button>
      </div>

      <h2 style={{ marginBottom: '0.75rem' }}>ユーザー一覧</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>ユーザー名</th>
            <th style={thStyle}>ロール</th>
            <th style={thStyle}>作成日時</th>
            <th style={thStyle}>パスワードリセット</th>
            <th style={thStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const isSelf = u.username === currentUsername
            return (
              <tr key={u.id} style={{ background: isSelf ? '#f8fafc' : undefined }}>
                <td style={tdStyle}>
                  {u.username}
                  {isSelf && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#64748b' }}>(自分)</span>}
                </td>
                <td style={tdStyle}>
                  {isSelf ? (
                    <span>{u.role === 'admin' ? '管理者' : '一般ユーザー'}</span>
                  ) : (
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}>
                      <option value="user">一般ユーザー</option>
                      <option value="admin">管理者</option>
                    </select>
                  )}
                </td>
                <td style={tdStyle}>{formatTimestamp(u.created_at)}</td>
                <td style={tdStyle}>
                  <input
                    type="password"
                    placeholder="新しいパスワード"
                    value={resetPasswords[u.id] ?? ''}
                    onChange={e => setResetPasswords(prev => ({ ...prev, [u.id]: e.target.value }))}
                  />
                  <button onClick={() => handlePasswordReset(u.id)}>リセット</button>
                </td>
                <td style={tdStyle}>
                  {!isSelf && (
                    <button onClick={() => handleDelete(u.id)} style={{ color: 'red' }}>削除</button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function PredictionTab() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [summary, setSummary] = useState<PredictionSummary | null>(null)
  const [records, setRecords] = useState<PredictionRecord[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchAll = () => {
    client.get('/api/admin/prediction/settings').then(r => setEnabled(r.data.enabled))
    client.get('/api/admin/prediction/report').then(r => {
      setSummary(r.data.summary)
      setRecords(r.data.records)
    })
  }

  useEffect(() => { fetchAll() }, [])

  const toggleEnabled = async () => {
    const next = !enabled
    await client.put('/api/admin/prediction/settings', { enabled: next })
    setEnabled(next)
    showToast(next ? '予測追跡を有効にしました' : '予測追跡を無効にしました')
  }

  const outcomeLabel = (outcome: string | null, verified: boolean) => {
    if (!verified) return <span style={{ color: '#64748b' }}>未検証</span>
    if (outcome === 'hit') return <span style={{ color: '#16a34a', fontWeight: 'bold' }}>的中</span>
    return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>外れ</span>
  }

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
          background: '#1e293b', color: '#fff', padding: '0.75rem 1.25rem',
          borderRadius: '6px', fontSize: '0.9rem',
        }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>傾向予測 精度レポート</h2>
        {enabled !== null && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
            予測追跡を有効にする
          </label>
        )}
      </div>

      {summary && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <StatCard label="総予測数" value={String(summary.total)} />
          <StatCard label="検証済み" value={String(summary.verified)} />
          <StatCard label="的中" value={String(summary.hits)} color="#16a34a" />
          <StatCard label="外れ" value={String(summary.misses)} color="#ef4444" />
          <StatCard label="未検証" value={String(summary.pending)} color="#64748b" />
          <StatCard
            label="的中率"
            value={summary.accuracy_pct != null ? `${summary.accuracy_pct}%` : '—'}
            color={summary.accuracy_pct != null && summary.accuracy_pct >= 70 ? '#16a34a' : '#f59e0b'}
          />
        </div>
      )}

      <h3 style={{ marginBottom: '0.75rem' }}>予測履歴（直近50件）</h3>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>発報日時</th>
            <th style={thStyle}>センサ / チャンネル</th>
            <th style={thStyle}>方向</th>
            <th style={thStyle}>予測到達閾値</th>
            <th style={thStyle}>予測到達時刻</th>
            <th style={thStyle}>結果</th>
            <th style={thStyle}>検証日時</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} style={{ background: r.outcome === 'hit' ? '#f0fdf4' : r.outcome === 'miss' ? '#fef2f2' : undefined }}>
              <td style={tdStyle}>{formatTimestamp(r.created_at)}</td>
              <td style={tdStyle}>{r.sensor_name}<br /><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.channel_name}</span></td>
              <td style={tdStyle}>{r.direction === 'up' ? '↑ 上昇' : '↓ 下降'}</td>
              <td style={tdStyle}>{r.limit_value}℃</td>
              <td style={tdStyle}>{formatTimestamp(r.predicted_at)}</td>
              <td style={tdStyle}>{outcomeLabel(r.outcome, r.verified)}</td>
              <td style={tdStyle}>{r.verified_at ? formatTimestamp(r.verified_at) : '—'}</td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>
                予測データがありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: '8px',
      padding: '0.75rem 1.25rem', minWidth: '100px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: color ?? '#1e293b' }}>{value}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '0.5rem',
  background: '#f1f5f9',
  textAlign: 'left',
}

const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '0.5rem',
}

export default Admin
