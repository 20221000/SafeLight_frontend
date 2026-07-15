import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSidebar } from '../../hooks/useSidebar'
import SidebarToggleBtn from '../Sidebar/SidebarToggleBtn'
import { adminStyles } from './adminStyles'

const NAV_ITEMS = [
  { key: 'dashboard',   label: '대시보드',      icon: '▦', path: '/admin' },
  { key: 'users',       label: '사용자 관리',    icon: '👤', path: '/admin/users' },
  { key: 'reports',     label: '신고 관리',      icon: '🔔', path: '/admin/reports' },
  { key: 'dangerzones', label: '위험구역 관리',  icon: '📍', path: '/admin/dangerzones' },
  { key: 'notices',     label: '공지 관리',      icon: '📢', path: '/admin/notices' },
]

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const day = days[date.getDay()]
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const sec = String(date.getSeconds()).padStart(2, '0')
  return `${y}.${m}.${d} (${day}) ${h}:${min}:${sec}`
}

export default function AdminLayout({ user, onLogout, active, title, children }) {
  const navigate = useNavigate()
  const { sidebarOpen, setSidebarOpen } = useSidebar()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      alert('관리자만 접근 가능합니다.')
      navigate('/')
    }
  }, [user, navigate])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    if (onLogout) onLogout()
    else {
      localStorage.removeItem('user')
      localStorage.removeItem('accessToken')
    }
    navigate('/')
  }

  const s = adminStyles

  return (
    <div style={s.root}>
      <aside style={{
        ...s.sidebar,
        width: sidebarOpen ? '200px' : '0px',
        padding: sidebarOpen ? '16px 12px' : '0',
        transition: 'width 0.3s ease, padding 0.3s ease',
      }}>
        <div style={s.logoRow}>
          <span style={{ fontSize: '20px' }}>🛡️</span>
          <span style={s.logoText}>Light Safe</span>
        </div>
        <div style={s.adminProfile}>
          <div style={s.adminAvatar}>관</div>
          <div>
            <div style={s.adminName}>{user?.nickname ?? user?.username ?? '관리자'}</div>
            <div style={s.adminEmail}>{user?.email ?? 'admin'}</div>
          </div>
        </div>
        <div style={s.adminBadge}>관리자 모드</div>
        <div style={s.divider} />
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              style={{ ...s.navItem, ...(item.key === active ? s.navItemActive : {}) }}
              onClick={() => navigate(item.path)}
            >
              <span style={{ fontSize: '15px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={s.divider} />
        <button style={{ ...s.navItem, color: '#FF3B3B' }} onClick={handleLogout}>
          <span>🚪</span><span>로그아웃</span>
        </button>
      </aside>

      <SidebarToggleBtn isOpen={sidebarOpen} onClick={() => setSidebarOpen(prev => !prev)} />

      <main style={s.main}>
        <div style={s.header}>
          <h2 style={s.pageTitle}>{title}</h2>
          <span style={s.dateText}>{formatDate(now)}</span>
        </div>
        <div style={s.scrollArea}>
          {children}
        </div>
      </main>
    </div>
  )
}
