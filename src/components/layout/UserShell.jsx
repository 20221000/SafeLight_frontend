// Light Safe 유저 셸 — 뷰포트 폭에 따라 데스크탑 셸 / 모바일 셸로 분기한다.
// 페이지는 이 컴포넌트만 쓰면 되고, 모바일 여부를 알 필요가 없다.
// 야간 모드 상태를 관리하고 루트에 .ls-dark 클래스를 부여한다(양쪽 셸 공통).
import { useState } from 'react'
import TopBar from './TopBar'
import IconRail from './IconRail'
import MobileShell from './MobileShell'
import useIsMobile from '../../hooks/useIsMobile'
import useUnreadNotifications from '../../hooks/useUnreadNotifications'

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
  // 벨 뱃지는 데스크탑·모바일 헤더가 같이 쓰므로 여기서 한 번만 조회한다.
  // 긴급과 쪽지를 합치지 않고 그대로 넘긴다 — 벨이 둘을 다른 색으로 그린다.
  const { emergency: unreadEmergency, message: unreadMessages } = useUnreadNotifications(user)

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
          unreadEmergency={unreadEmergency}
          unreadMessages={unreadMessages}
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
        unreadEmergency={unreadEmergency}
        unreadMessages={unreadMessages}
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
