// 관리자 위험구역 지도 — 활성 구역을 카카오맵 위에 원으로 그린다.
//
// 표와 카드로는 "몇 개가 어디에" 있는지가 안 읽힌다. 좌표 세 자리를 봐도 두 구역이
// 붙어 있는지 도시 반대편인지 알 수 없다. 사용자 지도 화면(MapView)과 같은 표현을 쓴다 —
// 위험도별 색, 반경만큼의 원, 가운데 레벨 배지. 관리자와 사용자가 같은 그림을 봐야
// "HIGH 라던 그 구역"을 서로 같은 것으로 가리킬 수 있다.
//
// **원은 항상 전부 그린다.** 선택한 구역만 그리면, 지도를 옮겨 다른 구역 자리에 가도
// 아무것도 없는 빈 지도가 된다. 카메라만 선택한 구역으로 옮긴다:
//   · 목록/표에서 구역을 고르면      → 그 구역이 화면에 꽉 차게 잡힌다
//   · 지도에서 원을 누르면            → 같은 선택이 일어난다(onSelect)
//   · 손으로 지도를 옮기면            → 그 자리의 다른 구역이 그대로 보인다
// 선택된 구역은 테두리를 굵게, 채움을 진하게 준다.
import { useEffect, useRef } from 'react'
import { LEVEL_HEX } from '../theme/tokens'

export default function DangerZoneMap({
  zones = [],
  height = 340,
  selectedId = null,
  onSelect,
  emptyText = '활성 위험구역이 없습니다.',
}) {
  const boxRef = useRef(null)
  const mapRef = useRef(null)
  const shapesRef = useRef([])
  // 처음 한 번만 전체를 담아 보여준다. 그 뒤로는 사용자가 옮긴 화면을 함부로 되돌리지 않는다.
  const fittedRef = useRef(false)
  // 리스너 안에서 최신 콜백을 읽는다(원을 다시 그릴 때마다 리스너를 재부착하지 않기 위해).
  const selectRef = useRef(onSelect)
  useEffect(() => { selectRef.current = onSelect })

  const active = zones.filter(z => z.isActive !== false && z.centerLatitude != null)

  // 구역 목록이 바뀌면 다시 그린다. 좌표·위험도·반경만 훑어 키를 만든다 —
  // zones 배열은 매 렌더 새로 만들어져 참조 비교로는 항상 '바뀐 것'이 된다.
  const signature = active
    .map(z => `${z.dangerZoneId}:${z.centerLatitude},${z.centerLongitude},${z.radius},${z.dangerLevel}`)
    .join('|')

  useEffect(() => {
    let alive = true

    const draw = () => {
      if (!alive || !boxRef.current || !window.kakao?.maps) return
      const { maps } = window.kakao

      if (!mapRef.current) {
        mapRef.current = new maps.Map(boxRef.current, {
          center: new maps.LatLng(37.5665, 126.9780), // 구역이 하나도 없을 때의 기본값(서울시청)
          level: 7,
        })
      }
      const map = mapRef.current

      shapesRef.current.forEach(({ circle, overlay }) => { circle.setMap(null); overlay?.setMap(null) })
      shapesRef.current = []

      if (active.length === 0) { map.relayout(); return }

      const bounds = new maps.LatLngBounds()

      active.forEach(zone => {
        const color = LEVEL_HEX[zone.dangerLevel] ?? LEVEL_HEX.LOW
        const center = new maps.LatLng(Number(zone.centerLatitude), Number(zone.centerLongitude))
        const picked = zone.dangerZoneId === selectedId

        const circle = new maps.Circle({
          center,
          radius: Number(zone.radius) || 300,
          strokeWeight: picked ? 4 : 2,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeStyle: 'solid',
          fillColor: color,
          fillOpacity: picked ? 0.3 : 0.15,
        })
        circle.setMap(map)

        const overlay = new maps.CustomOverlay({
          position: center,
          yAnchor: 1.5,
          content: `<div style="background:${color};color:#fff;padding:3px 8px;border-radius:6px;`
            + `font-size:11px;font-weight:700;white-space:nowrap;`
            + `box-shadow:0 2px 6px rgba(0,0,0,.3);">#${zone.dangerZoneId} ${zone.dangerLevel ?? ''}</div>`,
        })
        overlay.setMap(map)

        maps.event.addListener(circle, 'click', () => selectRef.current?.(zone))
        shapesRef.current.push({ circle, overlay })

        // 원 전체가 들어오도록 반경만큼 사방으로 넓혀 담는다.
        // 위도 1도 ≈ 111km, 경도는 위도가 높을수록 좁아진다(cos 보정).
        const dLat = (Number(zone.radius) || 300) / 111000
        const dLng = dLat / Math.max(0.1, Math.cos((Number(zone.centerLatitude) * Math.PI) / 180))
        bounds.extend(new maps.LatLng(Number(zone.centerLatitude) + dLat, Number(zone.centerLongitude) + dLng))
        bounds.extend(new maps.LatLng(Number(zone.centerLatitude) - dLat, Number(zone.centerLongitude) - dLng))
      })

      map.relayout()

      // 처음 그릴 때만 전체가 담기게 맞춘다. 이후 다시 그릴 때(위험도 변경 등)
      // 카메라를 건드리면 사용자가 보고 있던 자리가 튄다.
      if (!fittedRef.current) {
        fittedRef.current = true
        map.setBounds(bounds, 24, 24, 24, 24)
        if (active.length === 1 && map.getLevel() < 4) map.setLevel(4)
      }
    }

    if (window.kakao?.maps) { draw(); return () => { alive = false } }
    const timer = setInterval(() => {
      if (window.kakao?.maps) { clearInterval(timer); draw() }
    }, 300)
    return () => { alive = false; clearInterval(timer) }
    // signature 로 내용 변화를 감지한다(active 는 매 렌더 새 배열이라 의존성으로 못 쓴다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, selectedId])

  // 고른 구역으로 카메라를 옮긴다. 원은 위에서 이미 전부 그려 뒀으니,
  // 여기서 하는 일은 '어디를 보여줄지'뿐이다.
  const focus = active.find(z => z.dangerZoneId === selectedId)
  const focusKey = focus
    ? `${focus.dangerZoneId}:${focus.centerLatitude},${focus.centerLongitude},${focus.radius}`
    : null

  useEffect(() => {
    if (!focusKey || !mapRef.current || !window.kakao?.maps) return
    const { maps } = window.kakao
    const [lat, lng, radius] = [Number(focus.centerLatitude), Number(focus.centerLongitude), Number(focus.radius) || 300]

    // 원 하나가 여백을 두고 꽉 차게 잡히는 배율을 setBounds 가 알아서 고른다.
    const dLat = radius / 111000
    const dLng = dLat / Math.max(0.1, Math.cos((lat * Math.PI) / 180))
    const b = new maps.LatLngBounds()
    b.extend(new maps.LatLng(lat + dLat, lng + dLng))
    b.extend(new maps.LatLng(lat - dLat, lng - dLng))

    mapRef.current.setBounds(b, 40, 40, 40, 40)
    // 반경이 작으면 최대 배율까지 붙어 주변 지형이 안 보인다. 한 칸 물러선다.
    if (mapRef.current.getLevel() < 4) mapRef.current.setLevel(4)
    // focus 객체는 매 렌더 새로 찾은 것이라 focusKey 로만 반응한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey])

  // 컨테이너 크기가 바뀌면(창 크기·모바일 주소창) 타일이 잘린 채 남는다.
  useEffect(() => {
    if (!boxRef.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!mapRef.current) return
      const center = mapRef.current.getCenter()
      mapRef.current.relayout()
      mapRef.current.setCenter(center)
    })
    ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div
        ref={boxRef}
        style={{
          width: '100%', height: '100%',
          borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)',
        }}
      />
      {active.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
          background: 'rgba(255,255,255,.72)', borderRadius: 12,
        }}>
          {emptyText}
        </div>
      )}
    </div>
  )
}
