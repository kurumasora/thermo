import { Navigate } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  sub: string
  role: string
  exp: number
}

interface Props {
  children: React.ReactNode
  requireAdmin?: boolean
}

function isTokenValid(token: string): TokenPayload | null {
  try {
    const payload = jwtDecode<TokenPayload>(token)
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token')
      return null
    }
    return payload
  } catch {
    localStorage.removeItem('token')
    return null
  }
}

function RequireAuth({ children, requireAdmin = false }: Props) {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const payload = isTokenValid(token)

  if (!payload) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && payload.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default RequireAuth
