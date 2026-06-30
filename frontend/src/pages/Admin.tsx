import { useEffect, useState } from 'react'
import axios from 'axios'

type User = {
  id: number
  username: string
  role: string
  created_at: string
}

function Admin() {
  const [users, setUsers] = useState<User[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({})

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const fetchUsers = async () => {
    const res = await axios.get('/api/admin/users', { headers })
    setUsers(res.data)
  }

  useEffect(() => {
    if (!token) {
      window.location.href = '/login'
      return
    }
    fetchUsers()
  }, [])

  const handleCreate = async () => {
    if (!username || !password) return
    await axios.post('/api/admin/users', { username, password, role }, { headers })
    setUsername('')
    setPassword('')
    await fetchUsers()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('削除しますか？')) return
    await axios.delete(`/api/admin/users/${id}`, { headers })
    setUsers(users.filter(u => u.id !== id))
  }

  const handleRoleChange = async (id: number, newRole: string) => {
    await axios.put(`/api/admin/users/${id}/role`, { role: newRole }, { headers })
    setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u))
  }

  const handlePasswordReset = async (id: number) => {
    const newPassword = resetPasswords[id]
    if (!newPassword) return
    await axios.put(`/api/admin/users/${id}/password`, { password: newPassword }, { headers })
    setResetPasswords(prev => ({ ...prev, [id]: '' }))
    alert('パスワードをリセットしました')
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>ユーザー管理</h1>

      <h2>ユーザー追加</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
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

      <h2>ユーザー一覧</h2>
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
          {users.map(u => (
            <tr key={u.id}>
              <td style={tdStyle}>{u.username}</td>
              <td style={tdStyle}>
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                >
                  <option value="user">一般ユーザー</option>
                  <option value="admin">管理者</option>
                </select>
              </td>
              <td style={tdStyle}>{u.created_at}</td>
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
                <button onClick={() => handleDelete(u.id)} style={{ color: 'red' }}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
