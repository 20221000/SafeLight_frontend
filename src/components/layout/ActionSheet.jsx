// 모바일 액션 바텀시트 — 카드의 '⋮'(더보기)에서 여는 모달형 시트.
// 데스크탑 테이블의 행 버튼 묶음을 대체한다. actions: [{ label, tone, disabled, selected, onClick }]
// tone: 'default' | 'primary' | 'safe' | 'danger'
// selected: 선택지 목록으로 쓸 때(정렬 등) 현재 값 표시. 액션 목록에서는 그냥 생략한다.
const TONE_COLOR = {
  default: 'var(--text-strong)',
  primary: 'var(--blue-primary)',
  safe: 'var(--safe)',
  danger: 'var(--danger)',
}

export default function ActionSheet({ title, subtitle, actions = [], onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.45)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderTopLeftRadius: 18, borderTopRightRadius: 18,
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          boxShadow: '0 -4px 24px rgba(15,23,42,.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <span style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>
        {title && (
          <div style={{ padding: '4px 20px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
        )}
        <div style={{ padding: '6px 10px 10px' }}>
          {actions.map(a => (
            <button
              key={a.label}
              onClick={() => { if (!a.disabled) { onClose(); a.onClick() } }}
              disabled={a.disabled}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                width: '100%', minHeight: 48, padding: '0 12px', textAlign: 'left',
                border: 'none', borderRadius: 11, fontFamily: 'inherit',
                background: a.selected ? 'var(--blue-tint)' : 'transparent',
                fontSize: 14.5, fontWeight: a.selected ? 800 : 600, cursor: a.disabled ? 'default' : 'pointer',
                color: a.disabled ? 'var(--text-muted)'
                  : a.selected ? 'var(--blue-primary)' : (TONE_COLOR[a.tone] ?? TONE_COLOR.default),
                opacity: a.disabled ? 0.45 : 1,
              }}
            >
              {a.label}
              {a.selected && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              )}
            </button>
          ))}
          <button
            onClick={onClose}
            style={{
              display: 'block', width: '100%', minHeight: 48, marginTop: 4, border: '1px solid var(--border)',
              background: 'var(--surface)', borderRadius: 11, fontFamily: 'inherit', fontSize: 14.5,
              fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
