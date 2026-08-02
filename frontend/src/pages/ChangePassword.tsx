import { useState } from 'react'
import client from '../api/client'

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async () => {
    if (newPassword !== confirm) { showToast('新しいパスワードが一致しません', 'error'); return }
    if (newPassword.length < 4) { showToast('パスワードは4文字以上で設定してください', 'error'); return }
    try {
      await client.put('/api/auth/password', { current_password: currentPassword, new_password: newPassword })
      setCurrentPassword(''); setNewPassword(''); setConfirm('')
      showToast('パスワードを変更しました', 'success')
    } catch (err: any) {
      showToast(err.response?.data?.detail ?? 'エラーが発生しました', 'error')
    }
  }

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '1.75rem 2rem' }}>

      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: toast.type === 'success' ? '#22c55e' : '#ef4444',
          color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, fontSize: '0.875rem',
        }}>
          {toast.msg}
        </div>
      )}

      <h1 style={{ fontSize: '1.4rem', fontWeight: 400, color: '#0f172a', margin: '0 0 1.5rem' }}>パスワード変更</h1>

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '1.5rem', maxWidth: '400px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="現在のパスワード">
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="新しいパスワード">
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="確認（再入力）">
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <button onClick={handleSubmit} style={primaryBtnStyle}>変更する</button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, marginBottom: '0.35rem' }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.55rem 0.75rem', fontSize: '0.875rem',
  border: '1px solid #e2e8f0', borderRadius: '6px',
  color: '#334155', background: '#f8fafc', outline: 'none',
}

const primaryBtnStyle: React.CSSProperties = {
  marginTop: '1.25rem', padding: '0.6rem 1.25rem',
  background: '#1e293b', color: '#fff',
  border: 'none', borderRadius: '8px',
  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
}

export default ChangePassword
