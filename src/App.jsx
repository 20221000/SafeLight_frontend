import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import MainPage from './pages/MainPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RoutePage from './pages/RoutePage'
import CommunityPage from './pages/CommunityPage'
import MyInfoPage from './pages/MyInfoPage'
import FriendsPage from './pages/FriendsPage'
import PostDetailPage from './pages/PostDetailPage'
import PostWritePage from './pages/PostWritePage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminUserPage from './pages/AdminUserPage'
import AdminReportPage from './pages/AdminReportPage'
import AdminDangerZonePage from './pages/AdminDangerZonePage'
import AdminNoticePage from './pages/AdminNoticePage'
import './App.css'

function AppRoutes() {
  const navigate = useNavigate()

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')
  }

  // 프로필 일부 변경 시 앱 상태 + localStorage 동기화 (상단바/아바타 즉시 반영)
  const handleUpdateUser = (patch) => {
    setUser(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem('user', JSON.stringify(next))
      return next
    })
  }

  return (
    <Routes>
      <Route path="/" element={<MainPage user={user} onLogout={handleLogout} onGoLogin={() => navigate('/login')} />} />
      <Route
        path="/login"
        element={
          <LoginPage
            onLogin={(userData) => {
              handleLogin(userData)
              // 관리자면 /admin으로 이동
              if (userData.role === 'ADMIN') {
                navigate('/admin')
              } else {
                navigate('/')
              }
            }}
            onGoRegister={() => navigate('/register')}
            onClose={() => navigate('/')}
          />
        }
      />
      <Route path="/register" element={<RegisterPage onGoLogin={() => navigate('/login')} onClose={() => navigate('/')} />} />
      <Route path="/route" element={<RoutePage user={user} onLogout={handleLogout} />} />
      <Route path="/community" element={<CommunityPage user={user} onLogout={handleLogout} />} />
      <Route path="/community/write" element={<PostWritePage user={user} onLogout={handleLogout} />} />
      <Route path="/community/:postId" element={<PostDetailPage user={user} onLogout={handleLogout} />} />
      <Route path="/myinfo" element={<MyInfoPage user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />} />
      <Route path="/myinfo/friends" element={<FriendsPage user={user} onLogout={handleLogout} />} />
      <Route path="/admin" element={<AdminDashboardPage user={user} onLogout={handleLogout} />} />
      <Route path="/admin/users" element={<AdminUserPage user={user} onLogout={handleLogout} />} />
      <Route path="/admin/reports" element={<AdminReportPage user={user} onLogout={handleLogout} />} />
      <Route path="/admin/dangerzones" element={<AdminDangerZonePage user={user} onLogout={handleLogout} />} />
      <Route path="/admin/notices" element={<AdminNoticePage user={user} onLogout={handleLogout} />} />
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}
