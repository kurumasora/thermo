import { Link, useNavigate } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  sub: string
  role: string
}

function Navbar() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  let role = ''
  if (token) {
    try {
      const payload = jwtDecode<TokenPayload>(token)
      role = payload.role
    } catch {
      // トークン不正な場合は無視
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <nav style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1.5rem', background: '#1e293b', color: '#fff', alignItems: 'center' }}>
      <span style={{ fontWeight: 'bold', marginRight: 'auto' }}>Thermonitor</span>
      <Link to="/" style={{ color: '#cbd5e1', textDecoration: 'none' }}>ダッシュボード</Link>
      {role === 'admin' && (
        <>
          <Link to="/settings" style={{ color: '#cbd5e1', textDecoration: 'none' }}>閾値設定</Link>
          <Link to="/admin" style={{ color: '#cbd5e1', textDecoration: 'none' }}>ユーザー管理</Link>
        </>
      )}
      <button onClick={handleLogout} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}>
        ログアウト
      </button>
    </nav>
  )
}

export default Navbar
