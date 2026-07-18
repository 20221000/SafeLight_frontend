import { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  // 모달 패턴: 로그인/회원가입으로 이동할 때 직전 페이지를 backgroundLocation 으로 넘기면
  // 그 페이지를 뒤에 남겨둔 채(블러) 위에 카드만 띄운다. state 가 없으면(직접 URL 진입) 전체 페이지.
  const backgroundLocation = location.state?.backgroundLocation

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

  const afterLogin = (userData) => {
    handleLogin(userData)
    // 관리자면 /admin, 아니면 홈으로. replace 로 /login 을 히스토리에서 치운다.
    navigate(userData.role === 'ADMIN' ? '/admin' : '/', { replace: true })
  }
  // 모달 닫기 — 뒤 배경 페이지로 돌아간다(모달로 열렸으면 뒤로가기, 아니면 홈).
  const closeAuth = () => (backgroundLocation ? navigate(-1) : navigate('/'))

  const loginEl = (asModal) => (
    <LoginPage
      modal={asModal}
      onClose={closeAuth}
      onLogin={afterLogin}
      onGoRegister={() => navigate('/register', asModal ? { state: { backgroundLocation } } : undefined)}
    />
  )
  const registerEl = (asModal) => (
    <RegisterPage
      modal={asModal}
      onClose={closeAuth}
      onGoLogin={() => navigate('/login', asModal ? { state: { backgroundLocation } } : undefined)}
    />
  )

  return (
    <>
      {/* backgroundLocation 이 있으면 그 위치의 페이지를 렌더(뒤 배경), 아니면 현재 위치 */}
      <Routes location={backgroundLocation || location}>
        <Route path="/" element={<MainPage user={user} onLogout={handleLogout} onGoLogin={() => navigate('/login', { state: { backgroundLocation: location } })} />} />
        <Route path="/login" element={loginEl(false)} />
        <Route path="/register" element={registerEl(false)} />
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

      {/* 모달 오버레이 — 뒤 페이지를 남겨둔 채 로그인/회원가입 카드만 띄운다 */}
      {backgroundLocation && (
        <Routes>
          <Route path="/login" element={loginEl(true)} />
          <Route path="/register" element={registerEl(true)} />
        </Routes>
      )}
    </>
  )
}

export default function App() {
  return <AppRoutes />
}
