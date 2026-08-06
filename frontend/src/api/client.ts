import axios from 'axios'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  exp: number
}

const client = axios.create()

client.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (!token) return config

  // リクエスト前に期限切れをチェックして即リダイレクト
  try {
    const { exp } = jwtDecode<TokenPayload>(token)
    if (exp * 1000 < Date.now()) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(new Error('token expired'))
    }
  } catch {
    localStorage.removeItem('token')
    window.location.href = '/login'
    return Promise.reject(new Error('token invalid'))
  }

  config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client
