import { Navigate } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  sub: string
  role: string
}

interface Props {
  children: React.ReactNode
  requireAdmin?: boolean
}

function RequireAuth({ children, requireAdmin = false }: Props) {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin) {
    try {
      const payload = jwtDecode<TokenPayload>(token)
      if (payload.role !== 'admin') {
        return <Navigate to="/" replace />
      }
    } catch {
      return <Navigate to="/login" replace />
    }
  }

  return <>{children}</>
}

export default RequireAuth
