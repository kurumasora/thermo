import { Link, useLocation, useNavigate } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  sub: string
  role: string
  exp: number
}

const NAV_ITEMS = [
  { to: '/', label: 'ダッシュボード', icon: '⊞' },
  { to: '/alerts', label: 'アラート履歴', icon: '⚠' },
  { to: '/admin', label: '管理', adminOnly: true, icon: '⚙' },
]

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = localStorage.getItem('token')

  let role = ''
  let username = ''
  if (token) {
    try {
      const payload = jwtDecode<TokenPayload>(token)
      if (payload.exp * 1000 >= Date.now()) {
        role = payload.role
        username = payload.sub
      }
    } catch {
      // ignore
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <aside style={{
      width: '200px',
      minHeight: '100svh',
      background: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* ロゴ */}
      <div style={{ padding: '1.5rem 1.25rem 1rem', borderBottom: '1px solid #334155' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
          Thermonitor
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>データロガーシステム</div>
      </div>

      {/* ナビゲーション */}
      <nav style={{ flex: 1, padding: '0.75rem 0' }}>
        {NAV_ITEMS.filter(item => !item.adminOnly || role === 'admin').map(item => (
          <Link
            key={item.to}
            to={item.to}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 1.25rem',
              color: isActive(item.to) ? '#f8fafc' : '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.88rem',
              fontWeight: isActive(item.to) ? 600 : 400,
              background: isActive(item.to) ? 'rgba(255,255,255,0.08)' : 'transparent',
              borderLeft: `3px solid ${isActive(item.to) ? '#3b82f6' : 'transparent'}`,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span style={{ fontSize: '0.9rem', opacity: 0.85 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* ユーザー */}
      <div style={{ borderTop: '1px solid #334155', padding: '0.75rem 1.25rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>{username}</div>
        <Link
          to="/change-password"
          style={{
            display: 'block',
            fontSize: '0.8rem',
            color: '#94a3b8',
            textDecoration: 'none',
            marginBottom: '0.5rem',
          }}
        >
          パスワード変更
        </Link>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', background: 'transparent', color: '#94a3b8',
            border: '1px solid #334155', padding: '0.35rem 0.5rem',
            borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
            textAlign: 'left',
          }}
        >
          ログアウト
        </button>
      </div>
    </aside>
  )
}

export default Navbar
