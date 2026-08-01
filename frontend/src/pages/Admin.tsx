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
  webhook_url: string | null
  in_sensor_map: boolean
}

type ChannelInput = {
  channel_no: number
  name: string
  unit: string
  upper_threshold: number
  lower_threshold: number
  slope_threshold: number
  regression_count: number
  trend_monitor: boolean
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
  judgement_type: string
  judgement_params: Record<string, number>
}

type JudgementType = { value: string; label: string }

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

type SmtpConfig = {
  host: string | null
  port: number
  username: string | null
  from_address: string | null
  password_set: boolean
}

type EmailRecipient = {
  id: number
  email: string
}

type NotificationSensor = {
  id: number
  name: string
  webhook_url: string | null
  webhook_enabled: boolean
  email_enabled: boolean
  recipients: EmailRecipient[]
}

type Tab = 'sensor' | 'threshold' | 'user' | 'prediction' | 'notification'

const TABS: { key: Tab; label: string }[] = [
  { key: 'sensor', label: 'センサ管理' },
  { key: 'threshold', label: '閾値設定' },
  { key: 'user', label: 'ユーザー管理' },
  { key: 'prediction', label: '予測精度' },
  { key: 'notification', label: '通知設定' },
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
      {tab === 'notification' && <NotificationTab />}
    </div>
  )
}

const emptyChannel = (): ChannelInput => ({
  channel_no: 1,
  name: '',
  unit: '℃',
  upper_threshold: 40,
  lower_threshold: 0,
  slope_threshold: 1.0,
  regression_count: 10,
  trend_monitor: false,
})

function SensorTab() {
  const [sensors, setSensors] = useState<SensorItem[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [sensorMapKeys, setSensorMapKeys] = useState<string[]>([])

  // 新規センサ追加フォーム
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSensorKey, setNewSensorKey] = useState('')
  const [newSensorName, setNewSensorName] = useState('')
  const [newChannels, setNewChannels] = useState<ChannelInput[]>([emptyChannel()])
  const [addError, setAddError] = useState<string | null>(null)

  const fetchSensors = () =>
    client.get('/api/sensors').then(res => setSensors(res.data))

  useEffect(() => {
    fetchSensors()
    client.get('/api/admin/sensor-map-keys').then(res => setSensorMapKeys(res.data.keys))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleToggle = async (id: number) => {
    const res = await client.put(`/api/admin/sensors/${id}/active`)
    setSensors(sensors.map(s => s.id === id ? { ...s, active: res.data.active } : s))
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\n関連する計測データ・アラート履歴は保持されます。`)) return
    await client.delete(`/api/admin/sensors/${id}`)
    showToast('センサを削除しました')
    fetchSensors()
  }

  const updateChannel = (idx: number, field: keyof ChannelInput, value: string | number | boolean) => {
    setNewChannels(prev => prev.map((ch, i) => i === idx ? { ...ch, [field]: value } : ch))
  }

  const handleAddSensor = async () => {
    setAddError(null)
    if (!newSensorKey) { setAddError('センサキーを選択してください'); return }
    if (!newSensorName) { setAddError('センサ名を入力してください'); return }
    if (newChannels.some(ch => !ch.name)) { setAddError('チャンネル名を入力してください'); return }

    try {
      await client.post('/api/admin/sensors', {
        sensor_key: newSensorKey,
        name: newSensorName,
        channels: newChannels,
      })
      showToast('センサを追加しました（初期状態は無効）')
      setShowAddForm(false)
      setNewSensorKey('')
      setNewSensorName('')
      setNewChannels([emptyChannel()])
      fetchSensors()
    } catch (e: any) {
      setAddError(e.response?.data?.detail ?? 'エラーが発生しました')
    }
  }

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: '#22c55e', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '6px', zIndex: 1000, fontSize: '0.9rem',
        }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>センサ管理</h2>
        <button onClick={() => { setShowAddForm(!showAddForm); setAddError(null) }}>
          {showAddForm ? 'キャンセル' : '＋ センサ追加'}
        </button>
      </div>

      {showAddForm && (
        <div style={{ border: '1px solid #3b82f6', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem', background: '#f8faff' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>新規センサ登録</h3>

          {addError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>
              {addError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center', maxWidth: '480px', marginBottom: '1rem' }}>
            <label>センサキー</label>
            <select value={newSensorKey} onChange={e => setNewSensorKey(e.target.value)}>
              <option value="">-- 選択 --</option>
              {sensorMapKeys.filter(k => !sensors.find(s => s.sensor_key === k)).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <label>センサ名</label>
            <input
              type="text"
              placeholder="例：倉庫1 温湿度センサ"
              value={newSensorName}
              onChange={e => setNewSensorName(e.target.value)}
            />
          </div>

          <h4 style={{ marginBottom: '0.5rem' }}>チャンネル設定</h4>
          {newChannels.map((ch, idx) => (
            <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.75rem', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong>CH{idx + 1}</strong>
                {newChannels.length > 1 && (
                  <button onClick={() => setNewChannels(prev => prev.filter((_, i) => i !== idx))} style={{ color: 'red', fontSize: '0.8rem' }}>削除</button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '0.4rem 0.75rem', alignItems: 'center' }}>
                <label>CH番号</label>
                <input type="number" min={1} value={ch.channel_no} onChange={e => updateChannel(idx, 'channel_no', Number(e.target.value))} />
                <label>チャンネル名</label>
                <input type="text" placeholder="例：温度" value={ch.name} onChange={e => updateChannel(idx, 'name', e.target.value)} />
                <label>単位</label>
                <input type="text" placeholder="℃" value={ch.unit} onChange={e => updateChannel(idx, 'unit', e.target.value)} />
                <label>傾向監視</label>
                <input type="checkbox" checked={ch.trend_monitor} onChange={e => updateChannel(idx, 'trend_monitor', e.target.checked)} />
                <label>上限閾値</label>
                <input type="number" value={ch.upper_threshold} onChange={e => updateChannel(idx, 'upper_threshold', Number(e.target.value))} />
                <label>下限閾値</label>
                <input type="number" value={ch.lower_threshold} onChange={e => updateChannel(idx, 'lower_threshold', Number(e.target.value))} />
                <label>傾き閾値</label>
                <input type="number" step="0.1" value={ch.slope_threshold} onChange={e => updateChannel(idx, 'slope_threshold', Number(e.target.value))} />
                <label>回帰データ数</label>
                <input type="number" value={ch.regression_count} onChange={e => updateChannel(idx, 'regression_count', Number(e.target.value))} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button onClick={() => setNewChannels(prev => [...prev, { ...emptyChannel(), channel_no: prev.length + 1 }])}>
              ＋ チャンネル追加
            </button>
            <button onClick={handleAddSensor} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
              登録する
            </button>
          </div>
        </div>
      )}

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
              <td style={tdStyle}>
                <code>{s.sensor_key}</code>
                {!s.in_sensor_map && (
                  <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#dc2626', background: '#fef2f2', padding: '0 4px', borderRadius: '3px' }}>
                    未登録
                  </span>
                )}
              </td>
              <td style={tdStyle}>
                <span style={{ color: s.active ? '#16a34a' : '#64748b', fontWeight: 'bold' }}>
                  {s.active ? '有効' : '無効'}
                </span>
              </td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleToggle(s.id)}>
                    {s.active ? '無効化' : '有効化'}
                  </button>
                  <button onClick={() => handleDelete(s.id, s.name)} style={{ color: '#dc2626' }}>
                    削除
                  </button>
                </div>
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
  const [judgementTypes, setJudgementTypes] = useState<JudgementType[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    client.get('/api/settings').then(res => setConfigs(res.data))
    client.get('/api/judgement-types').then(res => setJudgementTypes(res.data))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const update = (id: number, field: string, value: number | boolean | string) =>
    setConfigs(configs.map(c => c.sensor_channel_id === id ? { ...c, [field]: value } : c))

  const updateParam = (id: number, key: string, value: number) =>
    setConfigs(configs.map(c => c.sensor_channel_id === id
      ? { ...c, judgement_params: { ...c.judgement_params, [key]: value } }
      : c
    ))

  const handleSave = async (c: ChannelConfig) => {
    await client.put(`/api/settings/${c.sensor_channel_id}`, {
      upper_threshold: c.upper_threshold,
      lower_threshold: c.lower_threshold,
      slope_threshold: c.slope_threshold,
      regression_count: c.regression_count,
      trend_monitor: c.trend_monitor,
      judgement_type: c.judgement_type,
      judgement_params: c.judgement_params,
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
                  <label>傾向監視</label>
                  <input type="checkbox" checked={c.trend_monitor} onChange={e => update(c.sensor_channel_id, 'trend_monitor', e.target.checked)} />
                  {c.trend_monitor && <>
                    <label>判定方法</label>
                    <select value={c.judgement_type} onChange={e => update(c.sensor_channel_id, 'judgement_type', e.target.value)}>
                      {judgementTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {c.judgement_type === 'linear' && <>
                      <label>傾き閾値 ({c.unit}/10分)</label>
                      <input type="number" step="0.1" value={c.slope_threshold} onChange={e => update(c.sensor_channel_id, 'slope_threshold', Number(e.target.value))} />
                      <label>回帰データ数</label>
                      <input type="number" value={c.regression_count} onChange={e => update(c.sensor_channel_id, 'regression_count', Number(e.target.value))} />
                      <label>R²閾値</label>
                      <input type="number" step="0.01" min="0" max="1" value={c.judgement_params?.r2_threshold ?? 0.75} onChange={e => updateParam(c.sensor_channel_id, 'r2_threshold', Number(e.target.value))} />
                    </>}
                  </>}
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

function NotificationTab() {
  const [smtp, setSmtp] = useState<SmtpConfig>({ host: '', port: 587, username: '', from_address: '', password_set: false })
  const [password, setPassword] = useState('')
  const [sensors, setSensors] = useState<NotificationSensor[]>([])
  const [newEmails, setNewEmails] = useState<Record<number, string>>({})
  const [webhookInputs, setWebhookInputs] = useState<Record<number, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fetchAll = async () => {
    const [smtpRes, sensorRes] = await Promise.all([
      client.get('/api/admin/smtp-config'),
      client.get('/api/sensors'),
    ])
    setSmtp(smtpRes.data)
    const webhooks: Record<number, string> = {}
    const withRecipients = await Promise.all(
      sensorRes.data.map(async (s: any) => {
        const r = await client.get(`/api/admin/sensors/${s.id}/email-recipients`)
        webhooks[s.id] = s.webhook_url ?? ''
        return { ...s, recipients: r.data }
      })
    )
    setSensors(withRecipients)
    setWebhookInputs(webhooks)
  }

  useEffect(() => { fetchAll() }, [])

  const handleSmtpSave = async () => {
    await client.put('/api/admin/smtp-config', {
      host: smtp.host, port: smtp.port, username: smtp.username,
      from_address: smtp.from_address,
      ...(password ? { password } : {}),
    })
    setPassword('')
    showToast('SMTPの設定を保存しました')
  }

  const handleNotificationToggle = async (id: number, field: 'webhook_enabled' | 'email_enabled') => {
    const s = sensors.find(s => s.id === id)!
    const updated = { webhook_enabled: s.webhook_enabled, email_enabled: s.email_enabled, [field]: !s[field] }
    await client.put(`/api/admin/sensors/${id}/notification`, updated)
    setSensors(sensors.map(s => s.id === id ? { ...s, ...updated } : s))
  }

  const handleWebhookSave = async (id: number) => {
    await client.put(`/api/admin/sensors/${id}/webhook`, { webhook_url: webhookInputs[id] || null })
    setSensors(sensors.map(s => s.id === id ? { ...s, webhook_url: webhookInputs[id] || null } : s))
    showToast('Webhook URLを保存しました')
  }

  const handleAddEmail = async (sensorId: number) => {
    const email = newEmails[sensorId]?.trim()
    if (!email) return
    await client.post(`/api/admin/sensors/${sensorId}/email-recipients`, { email })
    setNewEmails(prev => ({ ...prev, [sensorId]: '' }))
    fetchAll()
    showToast('メールアドレスを追加しました')
  }

  const handleDeleteEmail = async (sensorId: number, recipientId: number) => {
    await client.delete(`/api/admin/email-recipients/${recipientId}`)
    setSensors(sensors.map(s => s.id === sensorId
      ? { ...s, recipients: s.recipients.filter(r => r.id !== recipientId) }
      : s
    ))
  }

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', background: '#22c55e', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '6px', zIndex: 1000, fontSize: '0.9rem' }}>
          {toast}
        </div>
      )}

      {/* SMTPサーバー設定 */}
      <h2 style={{ marginBottom: '0.75rem' }}>メールサーバー設定（共通）</h2>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', maxWidth: '480px', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center' }}>
          <label>SMTPホスト</label>
          <input placeholder="smtp.gmail.com" value={smtp.host ?? ''} onChange={e => setSmtp(p => ({ ...p, host: e.target.value }))} />
          <label>ポート</label>
          <input type="number" value={smtp.port} onChange={e => setSmtp(p => ({ ...p, port: Number(e.target.value) }))} />
          <label>ユーザー名</label>
          <input placeholder="送信元メールアドレス" value={smtp.username ?? ''} onChange={e => setSmtp(p => ({ ...p, username: e.target.value }))} />
          <label>パスワード</label>
          <input type="password" placeholder={smtp.password_set ? '（設定済み・変更する場合のみ入力）' : '未設定'} value={password} onChange={e => setPassword(e.target.value)} />
          <label>送信元アドレス</label>
          <input placeholder="no-reply@example.com" value={smtp.from_address ?? ''} onChange={e => setSmtp(p => ({ ...p, from_address: e.target.value }))} />
        </div>
        <button onClick={handleSmtpSave} style={{ marginTop: '0.75rem' }}>保存</button>
      </div>

      {/* センサごとの通知設定 */}
      <h2 style={{ marginBottom: '0.75rem' }}>センサごとの通知設定</h2>
      {sensors.map(s => (
        <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{s.name}</h3>

          {/* Teams通知 */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>Teams通知</strong>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={s.webhook_enabled} onChange={() => handleNotificationToggle(s.id, 'webhook_enabled')} />
                {s.webhook_enabled ? 'ON' : 'OFF'}
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Webhook URL（未設定の場合は共通URLを使用）"
                value={webhookInputs[s.id] ?? ''}
                onChange={e => setWebhookInputs(prev => ({ ...prev, [s.id]: e.target.value }))}
                style={{ width: '360px', fontSize: '0.85rem' }}
              />
              <button onClick={() => handleWebhookSave(s.id)}>保存</button>
              {s.webhook_url && <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>✓ 設定済</span>}
            </div>
          </div>

          {/* メール通知 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>メール通知</strong>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={s.email_enabled} onChange={() => handleNotificationToggle(s.id, 'email_enabled')} />
                {s.email_enabled ? 'ON' : 'OFF'}
              </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
              {s.recipients.map(r => (
                <span key={r.id} style={{ background: '#f1f5f9', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {r.email}
                  <button onClick={() => handleDeleteEmail(s.id, r.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="email"
                placeholder="通知先メールアドレスを追加"
                value={newEmails[s.id] ?? ''}
                onChange={e => setNewEmails(prev => ({ ...prev, [s.id]: e.target.value }))}
                style={{ width: '280px', fontSize: '0.85rem' }}
                onKeyDown={e => e.key === 'Enter' && handleAddEmail(s.id)}
              />
              <button onClick={() => handleAddEmail(s.id)}>追加</button>
            </div>
          </div>
        </div>
      ))}
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
