// 모바일 하단 탭바 — 데스크탑 IconRail을 대체한다. 지도 · 경로 · 커뮤니티 · 내 정보
// 관리자/로그인·로그아웃은 레일과 달리 '내 정보' 화면으로 위임한다(탭 5개 이상은 모바일에서 좁다).
import { useNavigate } from 'react-router-dom'
import { USER_NAV } from './navItems'

export const TAB_BAR_HEIGHT = 56

export default function MobileTabBar({ active }) {
  const navigate = useNavigate()

  return (
    <nav style={{
      flexShrink: 0, display: 'flex', alignItems: 'stretch',
      height: TAB_BAR_HEIGHT, paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      zIndex: 30,
    }}>
      {USER_NAV.map(item => {
        const on = item.key === active
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.to)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer',
              color: on ? 'var(--blue-primary)' : 'var(--text-muted)',
              fontFamily: 'inherit',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.1 : 1.9} strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, letterSpacing: '-.2px' }}>{item.shortLabel}</span>
          </button>
        )
      })}
    </nav>
  )
}
