// 바텀시트 드래그 — 핸들을 잡고 위아래로 끌면 그만큼 시트 높이가 따라오고, 놓으면 가장 가까운
// 스냅 지점으로 붙는다. 스냅은 3단계:
//   collapsed : 핸들 바만 남고 지도만 보이는 상태
//   mid       : 기본값. 시트 머리말 정도가 보인다
//   full      : 시트가 화면을 거의 다 덮는다
// 포인터 이벤트를 쓰므로 터치(모바일)와 마우스(데스크탑 검증)가 같은 코드로 동작한다.
import { useState, useRef, useEffect, useCallback } from 'react'

const SNAP_ORDER = ['collapsed', 'mid', 'full']

export default function useDragSheet(containerRef, {
  collapsed = 26,
  mid = 132,
  fullRatio = 0.92,
  initial = 'mid',
  enabled = true,
} = {}) {
  const [containerH, setContainerH] = useState(0)
  const [height, setHeight] = useState(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef(null)

  // 컨테이너 높이를 알아야 full 높이를 계산할 수 있다(주소창 노출로 바뀔 수 있어 관찰한다).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sync = () => setContainerH(el.clientHeight)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  const pointFor = useCallback((name) => {
    if (name === 'collapsed') return collapsed
    if (name === 'full') return containerH ? Math.round(containerH * fullRatio) : mid
    return mid
  }, [collapsed, mid, fullRatio, containerH])

  const snapTo = useCallback((name) => setHeight(pointFor(name)), [pointFor])

  // 사용자가 아직 안 건드렸으면(height === null) 초기 스냅을 그대로 쓴다.
  // effect로 setHeight 하지 않고 렌더에서 유도해, 컨테이너 크기를 처음 알게 될 때 생기는 추가 렌더를 피한다.
  const current = height ?? pointFor(initial)

  const onPointerDown = useCallback((e) => {
    if (!enabled) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { startY: e.clientY, startH: current, moved: 0 }
    setDragging(true)
  }, [enabled, current])

  const onPointerMove = useCallback((e) => {
    if (!drag.current) return
    const dy = drag.current.startY - e.clientY // 위로 끌면 양수 = 커진다
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dy))
    const max = pointFor('full')
    setHeight(Math.min(max, Math.max(collapsed, drag.current.startH + dy)))
  }, [collapsed, pointFor])

  const onPointerUp = useCallback(() => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return

    // 거의 안 움직였으면 탭으로 보고 mid ↔ full 토글
    if (d.moved < 5) {
      setHeight(h => ((h ?? pointFor(initial)) >= pointFor('full') - 2 ? pointFor('mid') : pointFor('full')))
      return
    }
    // 놓은 위치에서 가장 가까운 스냅으로
    setHeight((h) => {
      const cur = h ?? pointFor(initial)
      let best = pointFor('mid')
      let bestGap = Infinity
      for (const name of SNAP_ORDER) {
        const p = pointFor(name)
        const gap = Math.abs(p - cur)
        if (gap < bestGap) { bestGap = gap; best = p }
      }
      return best
    })
  }, [pointFor, initial])

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    // 브라우저가 이 제스처를 페이지 스크롤로 가로채지 못하게 한다.
    style: { touchAction: 'none' },
  }

  const isFull = containerH > 0 && current >= pointFor('full') - 2

  // 시트를 다 올리기 전에는 내용이 몇 줄 안 보이는데 스크롤만 먹어 답답하다.
  // 그래서 full 이 아니면 본문을 잡고 끌어도 시트가 올라가고(bodyProps = 드래그),
  // full 이 되면 본문은 스크롤에 양보한다(bodyProps = 빈 객체).
  const bodyProps = isFull ? { style: {} } : handleProps

  return {
    height: current,
    dragging,
    handleProps,
    bodyProps,
    snapTo,
    isFull,
  }
}
