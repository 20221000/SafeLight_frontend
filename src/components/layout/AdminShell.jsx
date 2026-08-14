// Safe Light 관리자 셸 — 뷰포트 폭에 따라 데스크탑 셸 / 모바일 셸로 분기한다.
// 데스크탑: 220px 사이드바 + 상단 헤더 + 스크롤 본문 (디자인 D 기준). 모바일: MobileAdminShell(하단 탭바).
// 관리자 가드와 신고수 배지 조회는 양쪽 공통이므로 여기서 처리해 내려준다.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../utils/adminApi'
import MobileAdminShell from './MobileAdminShell'
import { ADMIN_SECTIONS as SECTIONS, ADMIN_ICONS as ICONS } from './adminNavItems'
import useIsMobile from '../../hooks/useIsMobile'

// 신고 상태를 바꾼 화면이 배지에게 "다시 세라"고 알리는 통로.
// 배지 값은 AdminShell 이 들고 있는데 상태를 바꾸는 건 그 자식 페이지들이라 서로 닿지 않는다.
// 알림 벨의 notifyNotificationsChanged 와 같은 방식이다.
const ADMIN_REPORTS_CHANGED = 'ls:admin-reports-changed'
export const notifyAdminReportsChanged = () =>
  window.dispatchEvent(new Event(ADMIN_REPORTS_CHANGED))

export default function AdminShell({ user, onLogout, active, title, subtitle, headerRight, children }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  // 신고 관리 배지: 활성 위험구역들의 신고수 합계(=실제 신고 내역 수). AdminReportPage 집계 방식과 동일.
  const [reportCount, setReportCount] = useState(null)

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      alert('관리자만 접근 가능합니다.')
      navigate('/')
    }
  }, [user, navigate])

  // 마운트할 때 한 번 + 신고 상태가 바뀔 때마다 다시 센다.
  // 예전엔 마운트 때 한 번뿐이라, 허위신고로 처리해 서버 쪽 reportCount 가 줄어도
  // (updateDangerZoneLevelAndCount 가 허위 건을 빼고 다시 센다) 배지는 '1' 그대로 남았다.
  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return
    let alive = true

    const refresh = () => {
      apiGet('/danger-zones')
        .then(zones => {
          if (!alive) return
          const total = (Array.isArray(zones) ? zones : []).reduce((sum, z) => sum + (z.reportCount ?? 0), 0)
          setReportCount(total)
        })
        .catch(() => { /* 실패 시 배지 미표시 */ })
    }

    refresh()
    window.addEventListener(ADMIN_REPORTS_CHANGED, refresh)
    return () => { alive = false; window.removeEventListener(ADMIN_REPORTS_CHANGED, refresh) }
  }, [user])

  const handleLogout = () => {
    if (onLogout) onLogout()
    else {
      localStorage.removeItem('user')
      localStorage.removeItem('accessToken')
    }
    navigate('/')
  }

  if (isMobile) {
    return (
      <MobileAdminShell
        active={active}
        title={title}
        subtitle={subtitle}
        headerRight={headerRight}
        reportCount={reportCount}
        onLogout={handleLogout}
      >
        {children}
      </MobileAdminShell>
    )
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
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>Safe Light</div>
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

      {/* 본문 — flex 컬럼이라 아래 콘텐츠 영역이 남은 높이를 가진다.
          그래야 페이지가 'flex:1' 로 화면 끝까지 채울 수 있다(위험구역의 지도+목록 2열).
          내용이 짧은 페이지는 예전처럼 자연 높이로 쌓이고 아래가 남는다 — 달라지는 게 없다. */}
      <main className="ls-scroll" style={{
        flex: 1, overflowY: 'auto', minWidth: 0,
        display: 'flex', flexDirection: 'column',
      }}>
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 30px',
          borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 5,
          flexShrink: 0,
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
        <div style={{
          padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: 16,
          flex: 1, minHeight: 0,
        }}>
          {children}
        </div>
      </main>
    </div>
  )
}
