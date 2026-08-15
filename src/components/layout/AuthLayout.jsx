// 로그인/회원가입 공통 배경 — 화이트&블루 지도 그리드 앰비언스 + 중앙 카드
// 모바일(M2·M3)에서는 카드 여백을 줄여 입력 폭을 확보하고, 주소창 높이 변화에 100dvh로 대응한다.
// modal 모드(데스크탑): 뒤 페이지를 남겨둔 채 블러 오버레이 위에 카드만 띄운다.
import useIsMobile from '../../hooks/useIsMobile'
import Icon from '../Icon'
import { readNightMode } from '../../utils/nightMode'

export default function AuthLayout({ children, width = 420, modal = false, onClose }) {
  const isMobile = useIsMobile()
  // 이 화면은 UserShell 바깥이라 셸이 붙여주는 .ls-dark 가 닿지 않는다(모달도 마찬가지로
  // 뒤 페이지의 DOM 밖에 뜬다). 저장된 값을 직접 읽어 각 루트에 붙인다.
  // 여기엔 야간 모드 토글이 없으므로 마운트 시 한 번 읽으면 충분하다.
  const dark = readNightMode()
  const darkClass = dark ? 'ls-dark' : undefined

  // 데스크탑 모달: 현재 페이지를 블러 처리한 위로 로그인 카드만 뜬다.
  if (modal && !isMobile) {
    return (
      <div
        onClick={onClose}
        className={darkClass}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, background: 'rgba(15,23,42,.30)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative', width, maxWidth: '92vw', maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
            boxShadow: '0 24px 64px rgba(15,23,42,.30)', padding: '40px 38px',
          }}
        >
          {onClose && (
            <button
              onClick={onClose}
              aria-label="닫기"
              style={{
                position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 9, border: 'none',
                background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="x" size={20} />
            </button>
          )}
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={darkClass} style={{
      width: '100%', minHeight: '100dvh', overflowY: 'auto', background: 'var(--bg)', color: 'var(--text-strong)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(var(--auth-grid) 1px,transparent 1px),linear-gradient(90deg,var(--auth-grid) 1px,transparent 1px)',
        backgroundSize: '52px 52px', opacity: .7,
      }} />
      <div style={{ position: 'absolute', top: -120, left: -80, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,.10), transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -140, right: -60, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,.08), transparent 70%)' }} />

      <div style={{
        position: 'relative', width, maxWidth: isMobile ? 'calc(100% - 32px)' : '92vw',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, boxShadow: '0 12px 40px rgba(15,23,42,.08)',
        padding: isMobile ? '30px 22px' : '40px 38px', margin: '24px 0',
      }}>
        {children}
      </div>
    </div>
  )
}

export function AuthLogo({ subtitle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
      <div style={{
        width: 52, height: 52, borderRadius: 15, background: 'var(--blue-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(37,99,235,.35)',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px', marginTop: 14 }}>Safe Light</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</div>
    </div>
  )
}

// 공용 입력 필드 (아이콘 + input)
export function AuthField({ label, icon, ...inputProps }) {
  return (
    <>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 7 }}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, height: 48, padding: '0 14px',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16,
      }}>
        {icon}
        {/* minWidth:0 필수 — 없으면 좁은 화면에서 입력칸이 아이콘을 덮는다. */}
        <input
          {...inputProps}
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 14.5, color: 'var(--text-strong)', fontFamily: 'inherit' }}
        />
      </div>
    </>
  )
}
