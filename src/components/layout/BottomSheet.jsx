// 모바일 바텀시트 — 데스크탑 우측 드로어(rightDrawer)를 대체한다.
// 핸들을 위아래로 드래그해 collapsed(핸들만) ↔ mid ↔ full(전체) 사이를 오간다.
import { useRef, useEffect } from 'react'
import useDragSheet from '../../hooks/useDragSheet'
import useSheetHeadHeight from '../../hooks/useSheetHeadHeight'

// mid 높이를 제목 블록에서 실측하기 전까지 쓰는 기본값(셸의 초기 --ls-sheet-peek 이기도 하다).
export const SHEET_PEEK = 132
// collapsed 상태 = 핸들 바만 남는 높이
export const SHEET_COLLAPSED = 26

export default function BottomSheet({ children, containerRef, onHeightChange }) {
  const selfRef = useRef(null)
  const sheetRef = useRef(null)
  // mid = 핸들 + 제목 블록. 조금만 올리면 '내 주변 안전 현황' 제목까지만 보인다.
  const mid = useSheetHeadHeight(sheetRef, { handle: SHEET_COLLAPSED, fallback: SHEET_PEEK })
  const { height, dragging, handleProps, bodyProps, isFull } = useDragSheet(containerRef ?? selfRef, {
    collapsed: SHEET_COLLAPSED,
    mid,
    fullRatio: 0.92,
    initial: 'mid',
  })

  // 플로팅 요소는 mid 까지만 따라 올라간다(full 이면 어차피 지도를 다 덮는다).
  useEffect(() => { onHeightChange?.(Math.min(height, mid)) }, [height, mid, onHeightChange])

  return (
    <div
      ref={sheetRef}
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 25,
        display: 'flex', flexDirection: 'column', height,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        boxShadow: '0 -4px 20px rgba(15,23,42,0.08)',
        // 드래그 중에는 손가락을 그대로 따라와야 하므로 트랜지션을 끈다.
        transition: dragging ? 'none' : 'height .24s ease',
      }}
    >
      <div
        {...handleProps}
        role="button"
        aria-label="안전 현황 시트 크기 조절"
        style={{
          ...handleProps.style,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: SHEET_COLLAPSED, minHeight: SHEET_COLLAPSED, cursor: 'grab',
        }}
      >
        <span style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border)' }} />
      </div>
      {/* full 일 때만 스크롤. 그 전에는 본문을 끌어도 시트가 올라간다(bodyProps). */}
      <div
        className="ls-scroll"
        {...bodyProps}
        style={{
          ...bodyProps.style,
          flex: 1, minHeight: 0, overflowX: 'hidden',
          overflowY: isFull ? 'auto' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
