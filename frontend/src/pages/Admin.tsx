import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'
import client from '../api/client'
import { formatTimestamp } from '../utils/format'

interface TokenPayload { sub: string }

type User = { id: number; username: string; role: string; created_at: string }
type SensorItem = { id: number; sensor_key: string; name: string; active: boolean; webhook_url: string | null; in_sensor_map: boolean }
type ChannelInput = { channel_no: number; name: string; unit: string; upper_threshold: number; lower_threshold: number; trend_monitor: boolean }
type ChannelConfig = {
  sensor_channel_id: number; upper_threshold: number; lower_threshold: number; trend_monitor: boolean
  channel_no: number; channel_name: string; unit: string; sensor_id: number; sensor_name: string
  sensor_key: string; judgement_type: string; judgement_params: Record<string, number>
}
type JudgementParamDef = { key: string; label: string; type: 'number'; default: number; step?: number; min?: number; max?: number }
type JudgementType = { value: string; label: string; params: JudgementParamDef[] }
type SmtpConfig = { host: string | null; port: number; username: string | null; from_address: string | null; password_set: boolean }
type EmailRecipient = { id: number; email: string }
type NotificationSensor = { id: number; name: string; webhook_url: string | null; webhook_enabled: boolean; email_enabled: boolean; recipients: EmailRecipient[] }

type Tab = 'sensor' | 'threshold' | 'user' | 'notification'
const TABS: { key: Tab; label: string }[] = [
  { key: 'sensor', label: 'センサ管理' },
  { key: 'threshold', label: '閾値設定' },
  { key: 'user', label: 'ユーザー管理' },
  { key: 'notification', label: '通知設定' },
]

function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) ?? 'sensor'
  const setTab = (t: Tab) => setSearchParams({ tab: t })

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '1.75rem 2rem' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 400, color: '#0f172a', margin: '0 0 1.25rem' }}>管理</h1>

      {/* サブタブ */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: '#e2e8f0', borderRadius: '8px', padding: '3px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '0.4rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: tab === t.key ? 600 : 400,
            background: tab === t.key ? '#fff' : 'transparent',
            color: tab === t.key ? '#0f172a' : '#64748b',
            boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'background 0.15s, color 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sensor' && <SensorTab />}
      {tab === 'threshold' && <ThresholdTab />}
      {tab === 'user' && <UserTab />}
      {tab === 'notification' && <NotificationTab />}
    </div>
  )
}

// ─── 共通トースト ───────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type?: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 1000,
      background: type === 'error' ? '#ef4444' : '#22c55e',
      color: '#fff', padding: '0.75rem 1.25rem',
      borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: '0.875rem',
    }}>
      {msg}
    </div>
  )
}

// ─── SensorTab ────────────────────────────────────────────────────────────────

const emptyChannel = (): ChannelInput => ({ channel_no: 1, name: '', unit: '℃', upper_threshold: 40, lower_threshold: 0, trend_monitor: false })

function SensorTab() {
  const [sensors, setSensors] = useState<SensorItem[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [sensorMapKeys, setSensorMapKeys] = useState<string[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSensorKey, setNewSensorKey] = useState('')
  const [newSensorName, setNewSensorName] = useState('')
  const [newChannels, setNewChannels] = useState<ChannelInput[]>([emptyChannel()])
  const [addError, setAddError] = useState<string | null>(null)

  const fetchSensors = () => client.get('/api/sensors').then(res => setSensors(res.data))
  useEffect(() => { fetchSensors(); client.get('/api/admin/sensor-map-keys').then(res => setSensorMapKeys(res.data.keys)) }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const handleToggle = async (id: number) => {
    const res = await client.put(`/api/admin/sensors/${id}/active`)
    setSensors(sensors.map(s => s.id === id ? { ...s, active: res.data.active } : s))
  }
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\n関連する計測データ・アラート履歴は保持されます。`)) return
    await client.delete(`/api/admin/sensors/${id}`)
    showToast('センサを削除しました'); fetchSensors()
  }
  const updateChannel = (idx: number, field: keyof ChannelInput, value: string | number | boolean) =>
    setNewChannels(prev => prev.map((ch, i) => i === idx ? { ...ch, [field]: value } : ch))

  const handleAddSensor = async () => {
    setAddError(null)
    if (!newSensorKey) { setAddError('センサキーを選択してください'); return }
    if (!newSensorName) { setAddError('センサ名を入力してください'); return }
    if (newChannels.some(ch => !ch.name)) { setAddError('チャンネル名を入力してください'); return }
    try {
      await client.post('/api/admin/sensors', { sensor_key: newSensorKey, name: newSensorName, channels: newChannels })
      showToast('センサを追加しました（初期状態は無効）')
      setShowAddForm(false); setNewSensorKey(''); setNewSensorName(''); setNewChannels([emptyChannel()])
      fetchSensors()
    } catch (e: any) { setAddError(e.response?.data?.detail ?? 'エラーが発生しました') }
  }

  return (
    <>
      {toast && <Toast msg={toast} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={sectionTitle}>センサ管理</h2>
        <button onClick={() => { setShowAddForm(!showAddForm); setAddError(null) }} style={outlineBtnStyle}>
          {showAddForm ? 'キャンセル' : '＋ センサ追加'}
        </button>
      </div>

      {showAddForm && (
        <div style={{ ...cardStyle, border: '1px solid #3b82f6', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>新規センサ登録</h3>
          {addError && <div style={errorBanner}>{addError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center', maxWidth: '480px', marginBottom: '1rem' }}>
            <label style={formLabel}>センサキー</label>
            <select value={newSensorKey} onChange={e => setNewSensorKey(e.target.value)} style={inputStyle}>
              <option value="">-- 選択 --</option>
              {sensorMapKeys.filter(k => !sensors.find(s => s.sensor_key === k)).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <label style={formLabel}>センサ名</label>
            <input type="text" placeholder="例：倉庫1 温湿度センサ" value={newSensorName} onChange={e => setNewSensorName(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>チャンネル設定</div>
          {newChannels.map((ch, idx) => (
            <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.875rem', marginBottom: '0.75rem', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>CH{idx + 1}</span>
                {newChannels.length > 1 && (
                  <button onClick={() => setNewChannels(prev => prev.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>削除</button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '0.4rem 0.75rem', alignItems: 'center' }}>
                <label style={formLabel}>CH番号</label>
                <input type="number" min={1} value={ch.channel_no} onChange={e => updateChannel(idx, 'channel_no', Number(e.target.value))} style={inputStyle} />
                <label style={formLabel}>チャンネル名</label>
                <input type="text" placeholder="例：温度" value={ch.name} onChange={e => updateChannel(idx, 'name', e.target.value)} style={inputStyle} />
                <label style={formLabel}>単位</label>
                <input type="text" placeholder="℃" value={ch.unit} onChange={e => updateChannel(idx, 'unit', e.target.value)} style={inputStyle} />
                <label style={formLabel}>傾向監視</label>
                <input type="checkbox" checked={ch.trend_monitor} onChange={e => updateChannel(idx, 'trend_monitor', e.target.checked)} />
                <label style={formLabel}>上限閾値</label>
                <input type="number" value={ch.upper_threshold} onChange={e => updateChannel(idx, 'upper_threshold', Number(e.target.value))} style={inputStyle} />
                <label style={formLabel}>下限閾値</label>
                <input type="number" value={ch.lower_threshold} onChange={e => updateChannel(idx, 'lower_threshold', Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button onClick={() => setNewChannels(prev => [...prev, { ...emptyChannel(), channel_no: prev.length + 1 }])} style={outlineBtnStyle}>
              ＋ チャンネル追加
            </button>
            <button onClick={handleAddSensor} style={primaryBtnStyle}>登録する</button>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.83rem' }}>
          <thead>
            <tr>
              {['センサ名', 'センサキー', '状態', '操作'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sensors.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>
                  <code style={{ fontSize: '0.82rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#334155' }}>{s.sensor_key}</code>
                  {!s.in_sensor_map && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#dc2626', background: '#fef2f2', padding: '0 4px', borderRadius: '3px' }}>未登録</span>}
                </td>
                <td style={tdStyle}>
                  <span style={{ color: s.active ? '#16a34a' : '#94a3b8', fontWeight: 600, fontSize: '0.82rem' }}>
                    {s.active ? '● 有効' : '○ 無効'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleToggle(s.id)} style={outlineBtnSmStyle}>{s.active ? '無効化' : '有効化'}</button>
                    <button onClick={() => handleDelete(s.id, s.name)} style={{ ...outlineBtnSmStyle, color: '#ef4444', borderColor: '#fca5a5' }}>削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── ThresholdTab ──────────────────────────────────────────────────────────────

function ThresholdTab() {
  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  const [judgementTypes, setJudgementTypes] = useState<JudgementType[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    client.get('/api/settings').then(res => setConfigs(res.data))
    client.get('/api/judgement-types').then(res => setJudgementTypes(res.data))
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const update = (id: number, field: string, value: number | boolean | string) =>
    setConfigs(configs.map(c => c.sensor_channel_id === id ? { ...c, [field]: value } : c))
  const updateParam = (id: number, key: string, value: number) =>
    setConfigs(configs.map(c => c.sensor_channel_id === id ? { ...c, judgement_params: { ...c.judgement_params, [key]: value } } : c))
  const handleSave = async (c: ChannelConfig) => {
    await client.put(`/api/settings/${c.sensor_channel_id}`, {
      upper_threshold: c.upper_threshold, lower_threshold: c.lower_threshold,
      trend_monitor: c.trend_monitor, judgement_type: c.judgement_type, judgement_params: c.judgement_params,
    })
    showToast(`${c.sensor_name} ${c.channel_name} を更新しました`)
  }

  const grouped = configs.reduce<Record<number, { sensor_name: string; sensor_key: string; channels: ChannelConfig[] }>>((acc, c) => {
    if (!acc[c.sensor_id]) acc[c.sensor_id] = { sensor_name: c.sensor_name, sensor_key: c.sensor_key, channels: [] }
    acc[c.sensor_id].channels.push(c); return acc
  }, {})

  return (
    <>
      {toast && <Toast msg={toast} />}
      <h2 style={sectionTitle}>閾値設定</h2>
      {Object.values(grouped).map(({ sensor_name, sensor_key, channels }) => (
        <div key={sensor_key} style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem' }}>{sensor_name}</div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {channels.map(c => (
              <div key={c.sensor_channel_id} style={{ ...cardStyle, minWidth: '280px', maxWidth: '340px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>{c.channel_name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 0.75rem', alignItems: 'center' }}>
                  <label style={formLabel}>上限閾値 ({c.unit})</label>
                  <input type="number" value={c.upper_threshold} onChange={e => update(c.sensor_channel_id, 'upper_threshold', Number(e.target.value))} style={inputStyle} />
                  <label style={formLabel}>下限閾値 ({c.unit})</label>
                  <input type="number" value={c.lower_threshold} onChange={e => update(c.sensor_channel_id, 'lower_threshold', Number(e.target.value))} style={inputStyle} />
                  <label style={formLabel}>傾向監視</label>
                  <input type="checkbox" checked={c.trend_monitor} onChange={e => update(c.sensor_channel_id, 'trend_monitor', e.target.checked)} />
                  {c.trend_monitor && <>
                    <label style={formLabel}>判定方法</label>
                    <select value={c.judgement_type} onChange={e => update(c.sensor_channel_id, 'judgement_type', e.target.value)} style={inputStyle}>
                      {judgementTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {judgementTypes.find(t => t.value === c.judgement_type)?.params.map(p => (
                      <>
                        <label key={`label-${p.key}`} style={formLabel}>{p.label}</label>
                        <input key={`input-${p.key}`} type="number" step={p.step} min={p.min} max={p.max}
                          value={c.judgement_params?.[p.key] ?? p.default}
                          onChange={e => updateParam(c.sensor_channel_id, p.key, Number(e.target.value))}
                          style={inputStyle} />
                      </>
                    ))}
                  </>}
                </div>
                <button onClick={() => handleSave(c)} style={{ ...primaryBtnStyle, marginTop: '0.875rem' }}>更新</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

// ─── UserTab ───────────────────────────────────────────────────────────────────

function UserTab() {
  const [users, setUsers] = useState<User[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({})

  const currentUsername = (() => {
    try { return jwtDecode<TokenPayload>(localStorage.getItem('token') ?? '').sub } catch { return '' }
  })()

  const fetchUsers = async () => { const res = await client.get('/api/admin/users'); setUsers(res.data) }
  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async () => {
    if (!username || !password) return
    await client.post('/api/admin/users', { username, password, role })
    setUsername(''); setPassword(''); await fetchUsers()
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
    const newPassword = resetPasswords[id]; if (!newPassword) return
    await client.put(`/api/admin/users/${id}/password`, { password: newPassword })
    setResetPasswords(prev => ({ ...prev, [id]: '' })); alert('パスワードをリセットしました')
  }

  return (
    <>
      <h2 style={sectionTitle}>ユーザー追加</h2>
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="ユーザー名" value={username} onChange={e => setUsername(e.target.value)} style={{ ...inputStyle, width: '160px' }} />
          <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, width: '160px' }} />
          <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
            <option value="user">一般ユーザー</option>
            <option value="admin">管理者</option>
          </select>
          <button onClick={handleCreate} style={primaryBtnStyle}>追加</button>
        </div>
      </div>

      <h2 style={sectionTitle}>ユーザー一覧</h2>
      <div style={cardStyle}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.83rem' }}>
          <thead>
            <tr>
              {['ユーザー名', 'ロール', '作成日時', 'パスワードリセット', '操作'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const isSelf = u.username === currentUsername
              return (
                <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={tdStyle}>
                    {u.username}
                    {isSelf && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#94a3b8' }}>(自分)</span>}
                  </td>
                  <td style={tdStyle}>
                    {isSelf ? (
                      <span style={{ fontSize: '0.82rem' }}>{u.role === 'admin' ? '管理者' : '一般ユーザー'}</span>
                    ) : (
                      <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} style={inputStyle}>
                        <option value="user">一般ユーザー</option>
                        <option value="admin">管理者</option>
                      </select>
                    )}
                  </td>
                  <td style={tdStyle}>{formatTimestamp(u.created_at)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="password" placeholder="新しいパスワード" value={resetPasswords[u.id] ?? ''}
                        onChange={e => setResetPasswords(prev => ({ ...prev, [u.id]: e.target.value }))}
                        style={{ ...inputStyle, width: '180px' }} />
                      <button onClick={() => handlePasswordReset(u.id)} style={outlineBtnSmStyle}>リセット</button>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {!isSelf && <button onClick={() => handleDelete(u.id)} style={{ ...outlineBtnSmStyle, color: '#ef4444', borderColor: '#fca5a5' }}>削除</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── NotificationTab ──────────────────────────────────────────────────────────

function NotificationTab() {
  const [smtp, setSmtp] = useState<SmtpConfig>({ host: '', port: 587, username: '', from_address: '', password_set: false })
  const [password, setPassword] = useState('')
  const [sensors, setSensors] = useState<NotificationSensor[]>([])
  const [newEmails, setNewEmails] = useState<Record<number, string>>({})
  const [webhookInputs, setWebhookInputs] = useState<Record<number, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const fetchAll = async () => {
    const [smtpRes, sensorRes] = await Promise.all([client.get('/api/admin/smtp-config'), client.get('/api/sensors')])
    setSmtp(smtpRes.data)
    const webhooks: Record<number, string> = {}
    const withRecipients = await Promise.all(sensorRes.data.map(async (s: any) => {
      const r = await client.get(`/api/admin/sensors/${s.id}/email-recipients`)
      webhooks[s.id] = s.webhook_url ?? ''
      return { ...s, recipients: r.data }
    }))
    setSensors(withRecipients); setWebhookInputs(webhooks)
  }
  useEffect(() => { fetchAll() }, [])

  const handleSmtpSave = async () => {
    await client.put('/api/admin/smtp-config', { host: smtp.host, port: smtp.port, username: smtp.username, from_address: smtp.from_address, ...(password ? { password } : {}) })
    setPassword(''); showToast('SMTPの設定を保存しました')
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
    const email = newEmails[sensorId]?.trim(); if (!email) return
    await client.post(`/api/admin/sensors/${sensorId}/email-recipients`, { email })
    setNewEmails(prev => ({ ...prev, [sensorId]: '' })); fetchAll(); showToast('メールアドレスを追加しました')
  }
  const handleDeleteEmail = async (sensorId: number, recipientId: number) => {
    await client.delete(`/api/admin/email-recipients/${recipientId}`)
    setSensors(sensors.map(s => s.id === sensorId ? { ...s, recipients: s.recipients.filter(r => r.id !== recipientId) } : s))
  }

  return (
    <>
      {toast && <Toast msg={toast} />}

      <h2 style={sectionTitle}>メールサーバー設定（共通）</h2>
      <div style={{ ...cardStyle, maxWidth: '480px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center' }}>
          <label style={formLabel}>SMTPホスト</label>
          <input placeholder="smtp.gmail.com" value={smtp.host ?? ''} onChange={e => setSmtp(p => ({ ...p, host: e.target.value }))} style={inputStyle} />
          <label style={formLabel}>ポート</label>
          <input type="number" value={smtp.port} onChange={e => setSmtp(p => ({ ...p, port: Number(e.target.value) }))} style={inputStyle} />
          <label style={formLabel}>ユーザー名</label>
          <input placeholder="送信元メールアドレス" value={smtp.username ?? ''} onChange={e => setSmtp(p => ({ ...p, username: e.target.value }))} style={inputStyle} />
          <label style={formLabel}>パスワード</label>
          <input type="password" placeholder={smtp.password_set ? '（設定済み）' : '未設定'} value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          <label style={formLabel}>送信元アドレス</label>
          <input placeholder="no-reply@example.com" value={smtp.from_address ?? ''} onChange={e => setSmtp(p => ({ ...p, from_address: e.target.value }))} style={inputStyle} />
        </div>
        <button onClick={handleSmtpSave} style={{ ...primaryBtnStyle, marginTop: '0.875rem' }}>保存</button>
      </div>

      <h2 style={sectionTitle}>センサごとの通知設定</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sensors.map(s => (
          <div key={s.id} style={cardStyle}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>{s.name}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Teams */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Teams通知</span>
                  <TogglePill checked={s.webhook_enabled} onChange={() => handleNotificationToggle(s.id, 'webhook_enabled')} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" placeholder="Webhook URL" value={webhookInputs[s.id] ?? ''}
                    onChange={e => setWebhookInputs(prev => ({ ...prev, [s.id]: e.target.value }))}
                    style={{ ...inputStyle, flex: 1, fontSize: '0.8rem' }} />
                  <button onClick={() => handleWebhookSave(s.id)} style={outlineBtnSmStyle}>保存</button>
                </div>
                {s.webhook_url && <span style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem', display: 'block' }}>✓ 設定済</span>}
              </div>

              {/* メール */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>メール通知</span>
                  <TogglePill checked={s.email_enabled} onChange={() => handleNotificationToggle(s.id, 'email_enabled')} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {s.recipients.map(r => (
                    <span key={r.id} style={{ background: '#f1f5f9', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#475569' }}>
                      {r.email}
                      <button onClick={() => handleDeleteEmail(s.id, r.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', lineHeight: 1 }}>✕</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="email" placeholder="通知先メールアドレスを追加" value={newEmails[s.id] ?? ''}
                    onChange={e => setNewEmails(prev => ({ ...prev, [s.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddEmail(s.id)}
                    style={{ ...inputStyle, flex: 1, fontSize: '0.8rem' }} />
                  <button onClick={() => handleAddEmail(s.id)} style={outlineBtnSmStyle}>追加</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function TogglePill({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      padding: '0.15rem 0.6rem', borderRadius: '99px', border: 'none', cursor: 'pointer',
      fontSize: '0.75rem', fontWeight: 600,
      background: checked ? '#dcfce7' : '#f1f5f9',
      color: checked ? '#16a34a' : '#94a3b8',
    }}>
      {checked ? 'ON' : 'OFF'}
    </button>
  )
}

// ─── スタイル定数 ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}
const sectionTitle: React.CSSProperties = { margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }
const formLabel: React.CSSProperties = { fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }
const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem', fontSize: '0.83rem',
  border: '1px solid #e2e8f0', borderRadius: '6px',
  color: '#334155', background: '#f8fafc', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const primaryBtnStyle: React.CSSProperties = {
  padding: '0.45rem 1.1rem', background: '#1e293b', color: '#fff',
  border: 'none', borderRadius: '6px', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
}
const outlineBtnStyle: React.CSSProperties = {
  padding: '0.45rem 1rem', background: '#fff', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.83rem', cursor: 'pointer',
}
const outlineBtnSmStyle: React.CSSProperties = {
  padding: '0.3rem 0.75rem', background: '#fff', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
}
const errorBanner: React.CSSProperties = {
  background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px',
  padding: '0.5rem 0.75rem', marginBottom: '0.75rem', color: '#dc2626', fontSize: '0.83rem',
}
const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', background: '#f8fafc', textAlign: 'left',
  color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.55rem 0.75rem', borderBottom: '1px solid #f1f5f9', color: '#334155',
}

export default Admin
