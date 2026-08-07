import { useEffect, useRef, useState } from 'react'

// 관리자 표의 행 액션 드롭다운 — 버튼 여러 개를 한 칸에 늘어놓는 대신 하나로 접는다.
// 버튼을 나란히 두면 행마다 색이 셋씩 튀어 표가 시끄럽고, 열 폭도 버튼 개수에 끌려간다.
//
// 데스크탑 전용이다. 모바일은 같은 자리에서 ActionSheet(바텀시트)를 그대로 쓴다 —
// 좁은 화면에서는 손가락이 닿는 아래쪽에서 올라오는 편이 낫기 때문이다.
// 대신 actions 배열 모양은 ActionSheet 와 맞춰 뒀다(caption 만 이쪽에 더 있다):
//   [{ label, tone, disabled, selected, caption, onClick }]
//
// 팝오버 모양은 CommunityPage 정렬 드롭다운과 맞췄다(surface + border + 그림자 + 6px 패딩).

const TONE_COLOR = {
  default: 'var(--text-strong)',
  primary: 'var(--blue-primary)',
  safe: 'var(--safe)',
  danger: 'var(--danger)',
}

export default function RowMenu({
  label = '관리',
  actions = [],
  width = 208,
  disabled = false,
  title,
}) {
  const [open, setOpen] = useState(false)
  // 마지막 행에서 아래로 펼치면 카드 밖으로 나가 스크롤이 생긴다. 자리가 없으면 위로 펼친다.
  const [up, setUp] = useState(false)
  // 기본은 버튼 왼쪽에 맞춰 바로 아래로 떨어뜨린다. 메뉴가 버튼보다 넓어서 표 오른쪽 끝
  // 열에서는 화면 밖으로 나가는데, 그때만 오른쪽 정렬로 뒤집는다.
  const [alignRight, setAlignRight] = useState(false)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)

  // 바깥 클릭·Esc 로 닫는다. 팝오버가 wrapRef **안에** 있어야 항목 클릭이 살아남는다 —
  // 밖에 그리면 mousedown 단계에서 언마운트돼 click 이 아예 발생하지 않는다.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (disabled) return
    if (!open) {
      // 열기 직전에 방향을 정한다. 항목 높이는 설명줄 유무로 갈린다.
      const rowH = actions.some(a => a.caption) ? 50 : 38
      const estimated = actions.length * rowH + 12
      const rect = btnRef.current?.getBoundingClientRect()
      setUp(Boolean(rect && rect.bottom + 6 + estimated > window.innerHeight))
      setAlignRight(Boolean(rect && rect.left + width + 8 > window.innerWidth))
    }
    setOpen(v => !v)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={disabled}
        title={title}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          padding: '7px 11px', borderRadius: 9, fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
          border: `1px solid ${open ? 'var(--blue-primary)' : 'var(--border)'}`,
          background: open ? 'var(--blue-tint)' : 'var(--surface)',
          color: disabled ? 'var(--text-muted)' : open ? 'var(--blue-primary)' : 'var(--text-strong)',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ opacity: 0.7 }}>
          <path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 30, width,
          ...(alignRight ? { right: 0 } : { left: 0 }),
          ...(up ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 10px 28px rgba(15,23,42,.14)', padding: 6,
        }}>
          {actions.map(a => (
            <button
              key={a.label}
              onClick={() => { if (!a.disabled) { setOpen(false); a.onClick() } }}
              disabled={a.disabled}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                width: '100%', padding: a.caption ? '7px 10px' : '0 10px', height: a.caption ? 'auto' : 38,
                borderRadius: 9, border: 'none', textAlign: 'left', fontFamily: 'inherit',
                background: a.selected ? 'var(--blue-tint)' : 'transparent',
                cursor: a.disabled ? 'default' : 'pointer',
                opacity: a.disabled && !a.selected ? 0.45 : 1,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{
                  display: 'block', fontSize: 13.5, fontWeight: a.selected ? 700 : 600,
                  color: a.selected ? 'var(--blue-primary)' : (TONE_COLOR[a.tone] ?? TONE_COLOR.default),
                }}>{a.label}</span>
                {a.caption && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                    {a.caption}
                  </span>
                )}
              </span>
              {a.selected && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--blue-primary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
