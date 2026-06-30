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

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      window.location.href = '/login'
      return
    }
    axios.get('/api/admin/users', { headers }).then(res => setUsers(res.data))
  }, [])

  const handleCreate = async () => {
    await axios.post('/api/admin/users', { username, password, role }, { headers })
    setUsername('')
    setPassword('')
    const res = await axios.get('/api/admin/users', { headers })
    setUsers(res.data)
  }

  const handleDelete = async (id: number) => {
    await axios.delete(`/api/admin/users/${id}`, { headers })
    setUsers(users.filter(u => u.id !== id))
  }

  return (
    <div>
      <h1>ユーザー管理</h1>
      <h2>ユーザー追加</h2>
      <input placeholder="ユーザー名" value={username} onChange={e => setUsername(e.target.value)} />
      <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} />
      <select value={role} onChange={e => setRole(e.target.value)}>
        <option value="user">一般ユーザー</option>
        <option value="admin">管理者</option>
      </select>
      <button onClick={handleCreate}>追加</button>
      <h2>ユーザー一覧</h2>
      <table>
        <thead>
          <tr>
            <th>ユーザー名</th>
            <th>ロール</th>
            <th>作成日時</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.role}</td>
              <td>{u.created_at}</td>
              <td><button onClick={() => handleDelete(u.id)}>削除</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Admin
