// Light Safe 관리자 모바일 셸 — 컴팩트 헤더 + 스크롤 본문 + 하단 탭바
// AdminShell과 props 계약이 동일하다(가드/신고수 조회는 AdminShell이 담당하고 여기로 내려준다).
// 데스크탑의 220px 사이드바 대신 탭바. 상태 칩은 AM1 목업대로 '정상'으로 축약.
// 목업(AM1~AM5)에는 로그아웃/일반화면 진입이 없지만, 없으면 모바일 관리자가 로그아웃할 방법이 사라져 헤더에 유지한다.
import { useNavigate } from 'react-router-dom'
import MobileAdminTabBar from './MobileAdminTabBar'

export default function MobileAdminShell({
  active,
  title,
  subtitle,
  headerRight,
  children,
  reportCount,
  onLogout,
}) {
  const navigate = useNavigate()

  const iconBtn = {
    width: 40, height: 40, minWidth: 40, borderRadius: 11, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: 'var(--bg)', color: 'var(--text-strong)', overflow: 'hidden',
    }}>
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', paddingTop: 'max(12px, env(safe-area-inset-top))',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 20,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, height: 26, padding: '0 9px',
          background: 'rgba(16,185,129,.1)', color: 'var(--safe)', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--safe)' }} />정상
        </div>
        <button onClick={() => navigate('/')} title="일반 화면으로" style={iconBtn}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
        </button>
        <button onClick={onLogout} title="로그아웃" style={iconBtn}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
        </button>
      </header>

      <main className="ls-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {headerRight && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px 0' }}>
            {headerRight}
          </div>
        )}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      </main>

      <MobileAdminTabBar active={active} reportCount={reportCount} />
    </div>
  )
}
