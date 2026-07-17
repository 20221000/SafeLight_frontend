// 관리자 모바일 하단 탭바 — 데스크탑 220px 사이드바를 대체한다.
// 대시보드 · 신고 · 사용자 · 위험구역 · 공지 (5개). 신고 탭에는 사이드바와 동일한 신고수 배지.
import { useNavigate } from 'react-router-dom'
import { ADMIN_TABS, ADMIN_ICONS } from './adminNavItems'

export const ADMIN_TAB_BAR_HEIGHT = 56

export default function MobileAdminTabBar({ active, reportCount }) {
  const navigate = useNavigate()

  return (
    <nav style={{
      flexShrink: 0, display: 'flex', alignItems: 'stretch',
      height: ADMIN_TAB_BAR_HEIGHT, paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'var(--surface)', borderTop: '1px solid var(--border)', zIndex: 30,
    }}>
      {ADMIN_TABS.map(item => {
        const on = item.key === active
        const badge = item.key === 'reports' && reportCount > 0 ? reportCount : null
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            style={{
              position: 'relative', flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 44,
              border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              color: on ? 'var(--blue-primary)' : 'var(--text-muted)',
            }}
          >
            <div style={{ position: 'relative', display: 'flex' }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.1 : 1.9} strokeLinecap="round" strokeLinejoin="round">{ADMIN_ICONS[item.key]}</svg>
              {badge != null && (
                <span style={{
                  position: 'absolute', top: -6, left: 12,
                  background: 'var(--danger)', color: '#fff', fontSize: 9, fontWeight: 800,
                  padding: '1px 5px', borderRadius: 10, fontFamily: "'Inter',sans-serif", lineHeight: 1.5,
                }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: on ? 700 : 600, letterSpacing: '-.3px' }}>{item.shortLabel}</span>
          </button>
        )
      })}
    </nav>
  )
}
