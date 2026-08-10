// 신고 위치 지도 팝업 — 관리자 표/카드에서 위치를 눌렀을 때 뜬다.
//
// 표에는 주소와 좌표만 있고 "그래서 거기가 어디냐"는 지도로만 답할 수 있다.
// 알림함 상세와 같은 MiniMap 을 쓴다 — 같은 신고를 두 화면에서 다르게 그릴 이유가 없다.
import MiniMap from './MiniMap'
import LocationText from './LocationText'
import useIsMobile from '../hooks/useIsMobile'

export default function LocationModal({ open, title, subtitle, lat, lng, onClose }) {
  const isMobile = useIsMobile()
  if (!open) return null

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? 14 : 20,
        background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--surface)', color: 'var(--text-strong)',
          border: '1px solid var(--border)', borderRadius: 18, padding: isMobile ? 18 : 22,
          boxShadow: '0 24px 64px rgba(15,23,42,.30)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</div>
          )}
        </div>

        <MiniMap lat={lat} lng={lng} height={isMobile ? 240 : 320} />

        {/* 지도는 '어디쯤'을 보여주고, 이 줄은 '정확히 어디'를 글자로 남긴다. */}
        <LocationText lat={lat} lng={lng} stack addressSize={14} coordSize={12} addressWeight={700} />

        <button
          onClick={onClose}
          style={{
            height: 46, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
          }}
        >
          닫기
        </button>
      </div>
    </div>
  )
}
