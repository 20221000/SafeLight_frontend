// 신고 위치 미니 지도. 카카오 SDK는 index.html에서 이미 불러온다.
// grow=true 면 높이를 고정하지 않고 남은 세로 공간을 채운다(데스크탑 상세 패널).
//
// 알림함과 관리자 신고 관리가 같은 것을 쓴다 — 같은 신고를 두 화면에서 다르게 그릴 이유가 없다.
import { useEffect, useRef } from 'react'

export default function MiniMap({ lat, lng, height, grow = false, level = 4 }) {
  const boxRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (lat == null || lng == null) return
    let alive = true

    const draw = () => {
      if (!alive || !boxRef.current || !window.kakao?.maps) return
      const center = new window.kakao.maps.LatLng(lat, lng)

      if (!mapRef.current) {
        mapRef.current = new window.kakao.maps.Map(boxRef.current, { center, level })
      } else {
        mapRef.current.relayout()
        mapRef.current.setCenter(center)
      }
      // 위치가 바뀌면 이전 마커를 걷어낸다 — 안 그러면 지도에 마커가 쌓인다.
      if (markerRef.current) markerRef.current.setMap(null)
      markerRef.current = new window.kakao.maps.Marker({ position: center, map: mapRef.current })
    }

    if (window.kakao?.maps) {
      draw()
      return () => { alive = false }
    }
    const timer = setInterval(() => {
      if (window.kakao?.maps) { clearInterval(timer); draw() }
    }, 300)
    return () => { alive = false; clearInterval(timer) }
  }, [lat, lng, level])

  // 높이가 고정이 아니면(grow) 박스 크기가 나중에 확정되거나 창 크기에 따라 바뀐다.
  // 카카오 지도는 컨테이너 크기 변화를 스스로 알지 못해 relayout 없이는 타일이 잘린 채 남는다.
  useEffect(() => {
    if (!grow || !boxRef.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!mapRef.current) return
      const center = mapRef.current.getCenter()
      mapRef.current.relayout()
      mapRef.current.setCenter(center)  // relayout 은 중심을 좌상단 기준으로 밀어 놓는다
    })
    ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [grow])

  return (
    <div
      ref={boxRef}
      style={{
        width: '100%',
        // minHeight 는 바닥선이다 — 창이 낮아도 이 아래로는 눌리지 않고 패널이 스크롤된다.
        ...(grow ? { flex: '1 1 auto', minHeight: 260 } : { height }),
        borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)',
      }}
    />
  )
}
