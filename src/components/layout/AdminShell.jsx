// Light Safe 관리자 셸 — 220px 사이드바 + 상단 헤더 + 스크롤 본문 (디자인 D 기준)
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../utils/adminApi'

const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  reports: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h4" /></>,
  dangerzones: <><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 11a3 3 0 0 0 0-6" /><path d="M18.5 20a5.5 5.5 0 0 0-3-4.9" /></>,
  notices: <><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8A3 3 0 0 1 6 15.5" /></>,
}

const SECTIONS = [
  {
    title: '모니터링',
    items: [
      { key: 'dashboard', label: '대시보드', path: '/admin' },
      { key: 'reports', label: '신고 관리', path: '/admin/reports' },
      { key: 'dangerzones', label: '위험 구역', path: '/admin/dangerzones' },
    ],
  },
  {
    title: '관리',
    items: [
      { key: 'users', label: '사용자 관리', path: '/admin/users' },
      { key: 'notices', label: '공지', path: '/admin/notices' },
    ],
  },
]

export default function AdminShell({ user, onLogout, active, title, subtitle, headerRight, children }) {
  const navigate = useNavigate()
  // 신고 관리 배지: 활성 위험구역들의 신고수 합계(=실제 신고 내역 수). AdminReportPage 집계 방식과 동일.
  const [reportCount, setReportCount] = useState(null)

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      alert('관리자만 접근 가능합니다.')
      navigate('/')
    }
  }, [user, navigate])

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return
    let alive = true
    apiGet('/danger-zones')
      .then(zones => {
        if (!alive) return
        const total = (Array.isArray(zones) ? zones : []).reduce((sum, z) => sum + (z.reportCount ?? 0), 0)
        setReportCount(total)
      })
      .catch(() => { /* 실패 시 배지 미표시 */ })
    return () => { alive = false }
  }, [user])

  const handleLogout = () => {
    if (onLogout) onLogout()
    else {
      localStorage.removeItem('user')
      localStorage.removeItem('accessToken')
    }
    navigate('/')
  }

  const navLink = (item) => {
    const on = item.key === active
    // 신고 관리 항목만 실제 신고수 배지 표시 (0이거나 로딩 전이면 숨김)
    const badge = item.key === 'reports' && reportCount > 0 ? reportCount : null
    return (
      <button
        key={item.key}
        onClick={() => navigate(item.path)}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 11,
          marginBottom: 3, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left',
          fontSize: 13.5, fontFamily: 'inherit',
          background: on ? 'var(--blue-tint)' : 'transparent',
          color: on ? 'var(--blue-primary)' : 'var(--text-muted)',
          fontWeight: on ? 700 : 600,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[item.key]}</svg>
        {item.label}
        {badge != null && (
          <span style={{
            marginLeft: 'auto', background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 800,
            padding: '1px 7px', borderRadius: 10, fontFamily: "'Inter',sans-serif",
          }}>{badge}</span>
        )}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', minHeight: 660, background: 'var(--bg)', color: 'var(--text-strong)' }}>
      {/* 사이드바 */}
      <nav style={{
        width: 220, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '18px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px', cursor: 'pointer' }} onClick={() => navigate('/admin')}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: 'var(--blue-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(37,99,235,.35)',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>Light Safe</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>관리자 콘솔</div>
          </div>
        </div>

        {SECTIONS.map(sec => (
          <div key={sec.title}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.5px', padding: '10px 8px 8px' }}>{sec.title}</div>
            {sec.items.map(navLink)}
          </div>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#1E40AF,#2563EB)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
          }}>{(user?.nickname || '관').charAt(0)}</div>
          <div style={{ lineHeight: 1.2, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.nickname || user?.username || '관제 담당자'}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>마포구 관제센터</div>
          </div>
          <button onClick={() => navigate('/')} title="일반 화면으로" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
          </button>
          <button onClick={handleLogout} title="로그아웃" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
          </button>
        </div>
      </nav>

      {/* 본문 */}
      <main className="ls-scroll" style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 30px',
          borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 5,
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.4px' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {headerRight}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', background: 'rgba(16,185,129,.1)', color: 'var(--safe)', borderRadius: 11, fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--safe)' }} />시스템 정상
            </div>
          </div>
        </header>
        <div style={{ padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
