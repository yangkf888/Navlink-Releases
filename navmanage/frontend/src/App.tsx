import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Licenses from './pages/Licenses'
import Plugins from './pages/Plugins'
import Profile from './pages/Profile'
import './index.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('navmanage_token')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setIsAuthenticated(data.valid)
    } catch {
      setIsAuthenticated(false)
    }
    setLoading(false)
  }

  const handleLogin = (token: string) => {
    localStorage.setItem('navmanage_token', token)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('navmanage_token')
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <BrowserRouter basename="/manage">
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/*" element={
          isAuthenticated ? (
            <Layout onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/licenses" element={<Licenses />} />
                <Route path="/plugins" element={<Plugins />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </Layout>
          ) : <Navigate to="/login" />
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
