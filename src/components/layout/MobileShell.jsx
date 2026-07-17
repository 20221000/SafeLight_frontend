// Light Safe 모바일 셸 — 컴팩트 헤더 + 본문(+ 선택적 바텀시트) + 하단 탭바
// UserShell과 props 계약이 동일하다. 데스크탑의 rightDrawer는 바텀시트로 매핑된다.
import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PlaceSearchBox from './PlaceSearchBox'
import MobileTabBar from './MobileTabBar'
import BottomSheet, { SHEET_PEEK } from './BottomSheet'

// 로고·검색창·야간모드를 같은 높이로 맞춰 헤더 리듬을 통일한다(PlaceSearchBox compact도 동일값).
const CTRL = 38

const iconBtn = (extra = {}) => ({
  width: CTRL, height: CTRL, minWidth: CTRL, borderRadius: 11, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
  ...extra,
})

// user·onLogout은 UserShell이 계속 넘기지만 여기선 쓰지 않는다(로그인/로그아웃은 MyInfoPage 담당).
export default function MobileShell({
  active,
  children,
  dark,
  onToggleDark,
  rightDrawer = null,
  scroll = true,
  contentBg = 'var(--bg)',
  onPickPlace,
}) {
  const navigate = useNavigate()
  const contentRef = useRef(null)
  const [sheetH, setSheetH] = useState(SHEET_PEEK)
  const onSheetHeight = useCallback((h) => setSheetH(h), [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: 'var(--bg)', color: 'var(--text-strong)', overflow: 'hidden',
    }}>
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', paddingTop: 'max(10px, env(safe-area-inset-top))',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 20,
      }}>
        <div
          onClick={() => navigate('/')}
          style={{
            width: CTRL, height: CTRL, minWidth: CTRL, borderRadius: 11, background: 'var(--blue-primary)', flexShrink: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(37,99,235,.35)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PlaceSearchBox onPickPlace={onPickPlace} compact showCurrentLocation={false} />
        </div>

        {/* 관리자 콘솔 · 로그인/로그아웃은 좁은 헤더에서 검색창을 눌러 MyInfoPage 헤더로 옮겼다. */}
        <button
          onClick={onToggleDark}
          title="야간 모드"
          style={iconBtn({
            border: `1px solid ${dark ? 'var(--blue-primary)' : 'var(--border)'}`,
            background: dark ? 'var(--blue-primary)' : 'var(--surface)',
            color: dark ? '#fff' : 'var(--text-muted)',
          })}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
        </button>
      </header>

      {/* --ls-sheet-peek: 바텀시트가 가리는 높이. 지도 위 플로팅 요소(SOS·줌 등)가 이만큼 위로 피한다.
          BottomSheet 가 이미 mid 로 잘라서 알려주므로 여기서 다시 자르지 않는다. */}
      <div ref={contentRef} style={{
        flex: 1, minHeight: 0, position: 'relative', background: contentBg,
        '--ls-sheet-peek': rightDrawer ? `${sheetH}px` : '0px',
      }}>
        <main
          className={scroll ? 'ls-scroll' : undefined}
          style={{
            position: 'absolute', inset: 0,
            overflowY: scroll ? 'auto' : 'hidden',
            overflowX: 'hidden',
          }}
        >
          {children}
        </main>
        {rightDrawer && (
          <BottomSheet containerRef={contentRef} onHeightChange={onSheetHeight}>
            {rightDrawer}
          </BottomSheet>
        )}
      </div>

      <MobileTabBar active={active} />
    </div>
  )
}
