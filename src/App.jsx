import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import MainPage from './pages/MainPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RoutePage from './pages/RoutePage'
import CommunityPage from './pages/CommunityPage'
import MyInfoPage from './pages/MyInfoPage'
import FriendsPage from './pages/FriendsPage'
import MessagesPage from './pages/MessagesPage'
import PostDetailPage from './pages/PostDetailPage'
import PostWritePage from './pages/PostWritePage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminUserPage from './pages/AdminUserPage'
import AdminReportPage from './pages/AdminReportPage'
import AdminDangerZonePage from './pages/AdminDangerZonePage'
import AdminNoticePage from './pages/AdminNoticePage'
import useIsMobile from './hooks/useIsMobile'
import { apiSend } from './utils/adminApi'
import './App.css'

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  // 모달 패턴: 로그인/회원가입으로 이동할 때 직전 페이지를 backgroundLocation 으로 넘기면
  // 그 페이지를 뒤에 남겨둔 채(블러) 위에 카드만 띄운다. state 가 없으면(직접 URL 진입) 전체 페이지.
  // 모달은 데스크탑 전용이다. 모바일에서 이 값을 그대로 쓰면 뒤 페이지가 화면을 다 채운 뒤
  // 로그인 카드가 그 아래(스크롤 밖)에 붙어 화면에 안 보인다 — 모바일은 항상 전체 페이지로 띄운다.
  const bgState = location.state?.backgroundLocation
  const backgroundLocation = isMobile ? undefined : bgState

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

  // 로컬 세션만 정리 (토큰 만료 감지 등 서버 통보가 불필요/불가능한 경우)
  const clearSession = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')
  }

  const handleLogout = () => {
    // 서버에도 로그아웃을 통보한다. 실패해도(네트워크·이미 만료 등) 로컬 정리는 진행.
    apiSend('/users/logout', 'POST').catch(() => {})
    clearSession()
    // 로그아웃 후에는 이전 로그인 정보가 남은 화면(내 정보·관리자)에 머물지 않도록
    // 항상 지도(홈)로 이동시킨다. replace 로 뒤로가기 시 보호 페이지로 못 돌아오게 한다.
    navigate('/', { replace: true })
  }

  // 앱 진입 시 저장된 토큰이 아직 유효한지 한 번 확인한다.
  // 401/403(명시적 인증 거부)일 때만 조용히 로그아웃 — 서버 다운/네트워크 오류로는 로그아웃하지 않는다.
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token || !user) return
    ;(async () => {
      try {
        const res = await fetch('/users/auth-check', { headers: { Authorization: `Bearer ${token}` } })
        if (res.status === 401 || res.status === 403) clearSession()
      } catch {
        /* 네트워크 오류: 토큰 무효 판단 불가 → 세션 유지 */
      }
    })()
    // 최초 1회만 검사한다 (user 변화마다 재검사할 필요 없음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const closeAuth = () => (bgState ? navigate(-1) : navigate('/'))

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
        <Route path="/community/:postId/edit" element={<PostWritePage user={user} onLogout={handleLogout} />} />
        <Route path="/community/:postId" element={<PostDetailPage user={user} onLogout={handleLogout} />} />
        <Route path="/myinfo" element={<MyInfoPage user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />} />
        <Route path="/myinfo/friends" element={<FriendsPage user={user} onLogout={handleLogout} />} />
        <Route path="/myinfo/messages" element={<MessagesPage user={user} onLogout={handleLogout} />} />
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
