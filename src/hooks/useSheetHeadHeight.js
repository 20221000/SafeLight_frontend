// 바텀시트를 조금만 올린 상태(mid)의 높이 — 제목 블록만 보이는 높이를 실측해서 정한다.
// 시트 안의 [data-sheet-head] 요소 높이 + 핸들 높이가 mid 가 된다.
// 상수로 박지 않는 이유: 안드로이드 글꼴 크기 설정이나 기기 폭에 따라 제목 줄 높이가 달라져
// 어떤 기기에서는 제목이 잘리고 어떤 기기에서는 아랫줄이 새어나온다.
import { useState, useEffect } from 'react'

export default function useSheetHeadHeight(sheetRef, { handle = 26, fallback = 132 } = {}) {
  const [headH, setHeadH] = useState(null)

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const head = sheet.querySelector('[data-sheet-head]')
    if (!head) return
    const sync = () => setHeadH(head.getBoundingClientRect().height)
    sync()
    // 글꼴 로드·지역명 역지오코딩 도착 등으로 제목 줄 높이가 나중에 바뀔 수 있어 계속 관찰한다.
    const ro = new ResizeObserver(sync)
    ro.observe(head)
    return () => ro.disconnect()
  }, [sheetRef])

  return headH == null ? fallback : Math.round(handle + headH)
}
