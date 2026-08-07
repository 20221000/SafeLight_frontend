// 알림 벨 — 데스크탑 TopBar와 모바일 헤더가 함께 쓴다.
// 누르면 알림 목록으로 이동한다.
//
// 두 종류를 색으로 나눈다. 개수 뱃지를 쓰다가 점으로 바꾼 이유는, 긴급과 쪽지가 섞이면
// 숫자 하나로는 "지금 급한 일인지"를 알 수 없기 때문이다. 급한 건 색으로 먼저 보여야 한다.
//
//   긴급만  → 벨이 빨개지고 빨간 점
//   쪽지만  → 벨은 그대로, 파란 점만
//   둘 다   → 벨이 빨개지고 빨간 점 아래에 파란 점
import { useNavigate } from 'react-router-dom'

// 점 하나. 어느 배경에서도 뭉개지지 않게 표면색 테두리를 두른다.
const dot = (color) => ({
  width: 8, height: 8, borderRadius: '50%', background: color,
  border: '2px solid var(--surface)', boxSizing: 'content-box',
})

export default function NotificationBell({ emergency = 0, message = 0, size = 40 }) {
  const navigate = useNavigate()
  const urgent = emergency > 0   // 벨 색을 바꾸는 건 긴급뿐이다
  const hasAny = urgent || message > 0

  const label = !hasAny ? '알림'
    : [urgent ? `긴급 알림 ${emergency}건` : '', message > 0 ? `쪽지 ${message}건` : '']
      .filter(Boolean).join(' · ')

  return (
    <button
      onClick={() => navigate('/myinfo/notifications')}
      title={label}
      aria-label={label}
      style={{
        position: 'relative', flexShrink: 0,
        width: size, height: size, minWidth: size, borderRadius: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        border: `1px solid ${urgent ? 'var(--danger)' : 'var(--border)'}`,
        background: 'var(--surface)',
        color: urgent ? 'var(--danger)' : 'var(--text-muted)',
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {hasAny && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          {urgent && <span style={dot('var(--danger)')} />}
          {message > 0 && <span style={dot('var(--blue-primary)')} />}
        </span>
      )}
    </button>
  )
}
