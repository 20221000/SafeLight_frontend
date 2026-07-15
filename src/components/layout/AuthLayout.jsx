// 로그인/회원가입 공통 배경 — 화이트&블루 지도 그리드 앰비언스 + 중앙 카드
export default function AuthLayout({ children, width = 420 }) {
  return (
    <div style={{
      width: '100vw', height: '100vh', overflowY: 'auto', background: 'var(--bg)', color: 'var(--text-strong)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(#EEF2F8 1px,transparent 1px),linear-gradient(90deg,#EEF2F8 1px,transparent 1px)',
        backgroundSize: '52px 52px', opacity: .7,
      }} />
      <div style={{ position: 'absolute', top: -120, left: -80, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,.10), transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -140, right: -60, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,.08), transparent 70%)' }} />

      <div style={{
        position: 'relative', width, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, boxShadow: '0 12px 40px rgba(15,23,42,.08)', padding: '40px 38px', margin: '24px 0',
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
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px', marginTop: 14 }}>Light Safe</div>
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
        <input
          {...inputProps}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14.5, color: 'var(--text-strong)', fontFamily: 'inherit' }}
        />
      </div>
    </>
  )
}
