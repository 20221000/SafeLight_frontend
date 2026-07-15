// Light Safe 유저 셸 — 상단바 + 좌측 레일 + 본문(+ 선택적 우측 드로어)
// 야간 모드 상태를 관리하고 루트에 .ls-dark 클래스를 부여한다.
import { useState } from 'react'
import TopBar from './TopBar'
import IconRail from './IconRail'

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
  const [dark, setDark] = useState(() => localStorage.getItem('ls-night') === '1')

  const toggleDark = () => {
    setDark(prev => {
      const next = !prev
      localStorage.setItem('ls-night', next ? '1' : '0')
      return next
    })
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
