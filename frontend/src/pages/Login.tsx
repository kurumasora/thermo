import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import client from '../api/client'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload { exp: number }

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const token = localStorage.getItem('token')
  if (token) {
    try {
      const payload = jwtDecode<TokenPayload>(token)
      if (payload.exp * 1000 > Date.now()) return <Navigate to="/" replace />
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div style={{
      minHeight: '100svh', background: '#f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '2.5rem 2rem',
        width: '100%', maxWidth: '360px',
      }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 400, color: '#0f172a', letterSpacing: '-0.3px' }}>
            Thermonitor
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            placeholder="ユーザー名"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            style={inputStyle}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            style={inputStyle}
            autoComplete="current-password"
          />
          {error && (
            <div style={{ fontSize: '0.82rem', color: '#ef4444', padding: '0.5rem 0.75rem', background: '#fef2f2', borderRadius: '6px' }}>
              {error}
            </div>
          )}
          <button onClick={handleLogin} style={loginBtnStyle}>ログイン</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.6rem 0.875rem', fontSize: '0.9rem',
  border: '1px solid #e2e8f0', borderRadius: '8px',
  outline: 'none', width: '100%', boxSizing: 'border-box',
  color: '#334155', background: '#f8fafc',
}

const loginBtnStyle: React.CSSProperties = {
  marginTop: '0.25rem', padding: '0.65rem',
  background: '#1e293b', color: '#fff',
  border: 'none', borderRadius: '8px',
  fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  width: '100%',
}

export default Login
