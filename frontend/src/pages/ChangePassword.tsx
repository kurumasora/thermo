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
    if (newPassword !== confirm) {
      showToast('新しいパスワードが一致しません', 'error')
      return
    }
    if (newPassword.length < 4) {
      showToast('パスワードは4文字以上で設定してください', 'error')
      return
    }
    try {
      await client.put('/api/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      showToast('パスワードを変更しました', 'success')
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? 'エラーが発生しました'
      showToast(detail, 'error')
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>パスワード変更</h1>

      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: toast.type === 'success' ? '#22c55e' : '#ef4444',
          color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, fontSize: '0.9rem',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: '360px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem 1rem', alignItems: 'center' }}>
        <label>現在のパスワード</label>
        <input
          type="password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
        />
        <label>新しいパスワード</label>
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
        <label>確認（再入力）</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
      </div>
      <button onClick={handleSubmit} style={{ marginTop: '1rem' }}>変更する</button>
    </div>
  )
}

export default ChangePassword
