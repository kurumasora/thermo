import { useEffect, useState } from 'react'
import {
  getSensors, getSensorEmailRecipients, addEmailRecipient, deleteEmailRecipient,
  updateSensorNotification, updateSensorWebhook,
} from '../../api/sensors'
import { getSmtpConfig, updateSmtpConfig } from '../../api/notification'
import { Toast } from './Toast'
import { TogglePill } from './TogglePill'
import { cardStyle, sectionTitle, formLabel, inputStyle, primaryBtnStyle, outlineBtnSmStyle } from './styles'

type SmtpConfig = { host: string | null; port: number; username: string | null; from_address: string | null; password_set: boolean }
type EmailRecipient = { id: number; email: string }
type NotificationSensor = { id: number; name: string; webhook_url: string | null; webhook_enabled: boolean; email_enabled: boolean; recipients: EmailRecipient[] }

export function NotificationTab() {
  const [smtp, setSmtp]     = useState<SmtpConfig>({ host: '', port: 587, username: '', from_address: '', password_set: false })
  const [password, setPassword] = useState('')
  const [sensors, setSensors]   = useState<NotificationSensor[]>([])
  const [newEmails, setNewEmails]       = useState<Record<number, string>>({})
  const [webhookInputs, setWebhookInputs] = useState<Record<number, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const fetchAll = async () => {
    const [smtpRes, sensorRes] = await Promise.all([getSmtpConfig(), getSensors()])
    setSmtp(smtpRes.data)
    const webhooks: Record<number, string> = {}
    const withRecipients = await Promise.all(sensorRes.data.map(async (s: any) => {
      const r = await getSensorEmailRecipients(s.id)
      webhooks[s.id] = s.webhook_url ?? ''
      return { ...s, recipients: r.data }
    }))
    setSensors(withRecipients); setWebhookInputs(webhooks)
  }
  useEffect(() => { fetchAll() }, [])

  const handleSmtpSave = async () => {
    await updateSmtpConfig({ host: smtp.host, port: smtp.port, username: smtp.username, from_address: smtp.from_address, ...(password ? { password } : {}) })
    setPassword(''); showToast('SMTPの設定を保存しました')
  }
  const handleNotificationToggle = async (id: number, field: 'webhook_enabled' | 'email_enabled') => {
    const s = sensors.find(s => s.id === id)!
    const updated = { webhook_enabled: s.webhook_enabled, email_enabled: s.email_enabled, [field]: !s[field] }
    await updateSensorNotification(id, updated)
    setSensors(sensors.map(s => s.id === id ? { ...s, ...updated } : s))
  }
  const handleWebhookSave = async (id: number) => {
    await updateSensorWebhook(id, webhookInputs[id] || null)
    setSensors(sensors.map(s => s.id === id ? { ...s, webhook_url: webhookInputs[id] || null } : s))
    showToast('Webhook URLを保存しました')
  }
  const handleAddEmail = async (sensorId: number) => {
    const email = newEmails[sensorId]?.trim(); if (!email) return
    await addEmailRecipient(sensorId, email)
    setNewEmails(prev => ({ ...prev, [sensorId]: '' })); fetchAll(); showToast('メールアドレスを追加しました')
  }
  const handleDeleteEmail = async (sensorId: number, recipientId: number) => {
    await deleteEmailRecipient(recipientId)
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
