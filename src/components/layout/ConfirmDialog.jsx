// 공용 확인 대화상자.
// window.confirm 은 모바일 브라우저에 따라 차단되거나 표시가 제각각이라(특히 반복 호출 시
// '추가 대화상자 차단'이 걸린다) 앱 안에서 직접 그린다. 데스크탑·모바일 렌더가 동일하다.
import Icon from '../Icon'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  const accent = danger ? 'var(--danger)' : 'var(--blue-primary)'

  return (
    <div
      onClick={onCancel}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: 340, maxWidth: '100%', background: 'var(--surface)', color: 'var(--text-strong)',
          border: '1px solid var(--border)', borderRadius: 18, padding: '26px 22px 18px',
          boxShadow: '0 24px 64px rgba(15,23,42,.30)', textAlign: 'center',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: '50%', margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: danger ? 'rgba(225,29,72,.10)' : 'var(--blue-tint)',
        }}>
          <Icon name={danger ? 'alert-triangle' : 'compass'} size={22} color={accent} />
        </div>

        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>{title}</div>
        {message && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.5 }}>{message}</div>
        )}

        <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 46, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            style={{
              flex: 1, height: 46, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
