import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import client from '../api/client'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  exp: number
}

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const token = localStorage.getItem('token')
  if (token) {
    try {
      const payload = jwtDecode<TokenPayload>(token)
      if (payload.exp * 1000 > Date.now()) {
        return <Navigate to="/" replace />
      }
    } catch {
      localStorage.removeItem('token')
    }
  }

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
