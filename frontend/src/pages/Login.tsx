import { useState } from 'react'
import client from '../api/client'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    try {
      const res = await client.post('/api/auth/login', { username, password })
      localStorage.setItem('token', res.data.access_token)
      window.location.href = '/'
    } catch {
      setError('ユーザー名またはパスワードが違います')
    }
  }

  return (
    <div>
      <h1>ログイン</h1>
      <input placeholder="ユーザー名" value={username} onChange={e => setUsername(e.target.value)} />
      <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin}>ログイン</button>
      {error && <p>{error}</p>}
    </div>
  )
}

export default Login