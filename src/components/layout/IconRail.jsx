// Light Safe 좌측 아이콘 레일 (64px) — 지도 · 경로 안내 · 커뮤니티 · 내 정보 + 로그아웃
import { useNavigate } from 'react-router-dom'

const NAV = [
  { key: 'map', label: '지도', to: '/', icon: (
    <><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>
  ) },
  { key: 'route', label: '경로 안내', to: '/route', icon: (
    <><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="5" r="2.4" /><path d="M8.2 18.2C13 17 15 13 15.6 7.2" /></>
  ) },
  { key: 'community', label: '커뮤니티', to: '/community', icon: (
    <path d="M21 11.5a8 8 0 0 1-8.5 7.9L4 21l1.6-4.2A8 8 0 1 1 21 11.5z" />
  ) },
  { key: 'myinfo', label: '내 정보', to: '/myinfo', icon: (
    <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>
  ) },
]

export default function IconRail({ active, user, onLogout }) {
  const navigate = useNavigate()
  const loggedIn = !!user

  return (
    <nav style={{
      width: 64, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 6,
    }}>
      {NAV.map(item => {
        const on = item.key === active
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.to)}
            title={item.label}
            style={{
              position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              width: 52, padding: '9px 0', border: 'none', borderRadius: 12, cursor: 'pointer',
              background: on ? 'var(--blue-tint)' : 'transparent',
              color: on ? 'var(--blue-primary)' : 'var(--text-muted)',
            }}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '-.2px' }}>{item.label}</span>
          </button>
        )
      })}
      <div style={{ flex: 1 }} />
      {user?.role === 'ADMIN' && (
        <button
          onClick={() => navigate('/admin')}
          title="관리자 콘솔"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 52, padding: '9px 0',
            border: 'none', background: 'transparent', color: 'var(--text-muted)', borderRadius: 12, cursor: 'pointer',
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
          <span style={{ fontSize: 9.5, fontWeight: 600 }}>관리자</span>
        </button>
      )}
      {loggedIn ? (
        <button
          onClick={onLogout}
          title="로그아웃"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 52, padding: '9px 0',
            border: 'none', background: 'transparent', color: 'var(--text-muted)', borderRadius: 12, cursor: 'pointer',
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
          <span style={{ fontSize: 9.5, fontWeight: 600 }}>로그아웃</span>
        </button>
      ) : (
        <button
          onClick={() => navigate('/login')}
          title="로그인"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 52, padding: '9px 0',
            border: 'none', background: 'transparent', color: 'var(--blue-primary)', borderRadius: 12, cursor: 'pointer',
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9" /></svg>
          <span style={{ fontSize: 9.5, fontWeight: 600 }}>로그인</span>
        </button>
      )}
    </nav>
  )
}
