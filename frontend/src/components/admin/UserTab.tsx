import { useEffect, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { getUsers, createUser, deleteUser, updateUserRole, updateUserPassword } from '../../api/users'
import { formatTimestamp } from '../../utils/format'
import { cardStyle, sectionTitle, inputStyle, primaryBtnStyle, outlineBtnSmStyle, thStyle, tdStyle } from './styles'

interface TokenPayload { sub: string }
type User = { id: number; username: string; role: string; created_at: string }

export function UserTab() {
  const [users, setUsers]       = useState<User[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('user')
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({})

  const currentUsername = (() => {
    try { return jwtDecode<TokenPayload>(localStorage.getItem('token') ?? '').sub } catch { return '' }
  })()

  const fetchUsers = async () => { const res = await getUsers(); setUsers(res.data) }
  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async () => {
    if (!username || !password) return
    await createUser(username, password, role)
    setUsername(''); setPassword(''); await fetchUsers()
  }
  const handleDelete = async (id: number) => {
    if (!confirm('削除しますか？')) return
    await deleteUser(id)
    setUsers(users.filter(u => u.id !== id))
  }
  const handleRoleChange = async (id: number, newRole: string) => {
    await updateUserRole(id, newRole)
    setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u))
  }
  const handlePasswordReset = async (id: number) => {
    const newPassword = resetPasswords[id]; if (!newPassword) return
    await updateUserPassword(id, newPassword)
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
