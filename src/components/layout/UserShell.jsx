// Light Safe 유저 셸 — 뷰포트 폭에 따라 데스크탑 셸 / 모바일 셸로 분기한다.
// 페이지는 이 컴포넌트만 쓰면 되고, 모바일 여부를 알 필요가 없다.
// 야간 모드 상태를 관리하고 루트에 .ls-dark 클래스를 부여한다(양쪽 셸 공통).
import { useState } from 'react'
import TopBar from './TopBar'
import IconRail from './IconRail'
import MobileShell from './MobileShell'
import useIsMobile from '../../hooks/useIsMobile'

export default function UserShell({
  user,
  onLogout,
  active,
  children,
  rightDrawer = null,
  scroll = true,
  contentBg = 'var(--bg)',
  onPickPlace,
}) {
  const isMobile = useIsMobile()
  const [dark, setDark] = useState(() => localStorage.getItem('ls-night') === '1')

  const toggleDark = () => {
    setDark(prev => {
      const next = !prev
      localStorage.setItem('ls-night', next ? '1' : '0')
      return next
    })
  }

  if (isMobile) {
    return (
      <div className={dark ? 'ls-dark' : undefined}>
        <MobileShell
          user={user}
          onLogout={onLogout}
          active={active}
          dark={dark}
          onToggleDark={toggleDark}
          rightDrawer={rightDrawer}
          scroll={scroll}
          contentBg={contentBg}
          onPickPlace={onPickPlace}
        >
          {children}
        </MobileShell>
      </div>
    )
  }

  return (
    <div
      className={dark ? 'ls-dark' : undefined}
      style={{
        display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 640,
        background: 'var(--bg)', color: 'var(--text-strong)',
      }}
    >
      <TopBar
        user={user}
        dark={dark}
        onToggleDark={toggleDark}
        onPickPlace={onPickPlace}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <IconRail active={active} user={user} onLogout={onLogout} />
        <main
          className={scroll ? 'ls-scroll' : undefined}
          style={{
            flex: 1, minWidth: 0, position: 'relative',
            overflowY: scroll ? 'auto' : 'hidden',
            overflowX: 'hidden',
            background: contentBg,
          }}
        >
          {children}
        </main>
        {rightDrawer}
      </div>
    </div>
  )
}
