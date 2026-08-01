import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Admin from './pages/Admin'
import ChangePassword from './pages/ChangePassword'
import Navbar from './components/Navbar'
import RequireAuth from './components/RequireAuth'

function Layout() {
  const location = useLocation()
  const showNavbar = location.pathname !== '/login'

  return (
    <>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
        <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        <Route path="/settings" element={<Navigate to="/admin?tab=threshold" />} />
        <Route path="/prediction" element={<Navigate to="/admin?tab=prediction" />} />
        <Route path="/admin" element={<RequireAuth requireAdmin><Admin /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}

export default App