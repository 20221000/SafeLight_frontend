import { useEffect, useRef, useCallback } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import Icon from '../Icon'
import { iconSvg } from '../iconSvg'

async function fetchMarkerData() {
  try {
    const res = await fetch('/cctvs')
    const json = await res.json()
    if (!json.success) return { cctv: [], streetLamp: [], safeZone: [] }

    const cctv = json.data.map(item => ({
      lat: item.latitude,
      lng: item.longitude,
      name: item.cctvName,
    }))

    return { cctv, streetLamp: [], safeZone: [] }
  } catch (err) {
    console.error('마커 데이터 조회 실패:', err)
    return { cctv: [], streetLamp: [], safeZone: [] }
  }
}

export default function MapView({ filters, onToggleFilter, dangerZones = [], routeState = null, searchTarget = null }) {
  // 모바일에서는 레이어 칩을 데스크탑의 3/4 크기로 줄인다(34 → 26px).
  const isMobile = useIsMobile()
  const CHIP_H = isMobile ? 26 : 34
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const clustererRef = useRef(null)
  const allDataRef = useRef({ cctv: [], streetLamp: [], safeZone: [] })
  const locationMarkerRef = useRef(null)
  const dangerZoneOverlaysRef = useRef([])
  const routePolylinesRef = useRef([])
  const routeMarkersRef = useRef([])
  const searchMarkerRef = useRef(null)
  const searchTargetRef = useRef(searchTarget) // 초기 지오로케이션이 검색 위치를 덮어쓰지 않도록 추적

  // 뷰포트 내 CCTV 마커 렌더링
  const renderCctvInBounds = useCallback(() => {
    if (!mapInstance.current || !clustererRef.current) return

    const bounds = mapInstance.current.getBounds()
    const data = allDataRef.current

    clustererRef.current.clear()

    const inBounds = data.cctv.filter(pos =>
      bounds.contain(new window.kakao.maps.LatLng(pos.lat, pos.lng))
    )

    const markers = inBounds.map(pos =>
      new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(pos.lat, pos.lng),
      })
    )

    clustererRef.current.addMarkers(markers)
  }, [])

  // 위험구역 그리기
  const drawDangerZones = useCallback((zones) => {
    if (!mapInstance.current || !window.kakao) return

    dangerZoneOverlaysRef.current.forEach(item => {
      item.circle?.setMap(null)
      item.overlay?.setMap(null)
    })
    dangerZoneOverlaysRef.current = []

    const LEVEL_COLOR = {
      HIGH:   { stroke: '#E11D48' },
      MEDIUM: { stroke: '#F59E0B' },
      LOW:    { stroke: '#10B981' },
    }

    zones.filter(z => z.isActive).forEach(zone => {
      const color = LEVEL_COLOR[zone.dangerLevel] ?? LEVEL_COLOR.LOW
      const center = new window.kakao.maps.LatLng(
        zone.centerLatitude, zone.centerLongitude
      )

      const circle = new window.kakao.maps.Circle({
        center,
        radius: zone.radius,
        strokeWeight: 2,
        strokeColor: color.stroke,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
        fillColor: color.stroke,
        fillOpacity: 0.15,
      })
      circle.setMap(mapInstance.current)

      const content = `
        <div style="
          background:${color.stroke};color:#fff;
          padding:3px 8px;border-radius:6px;
          font-size:11px;font-weight:700;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          white-space:nowrap;
        ">${iconSvg('alert-triangle', { size: 12, color: '#fff' })} ${zone.dangerLevel}</div>
      `
      const overlay = new window.kakao.maps.CustomOverlay({
        position: center, content, yAnchor: 1.5,
      })
      overlay.setMap(mapInstance.current)

      dangerZoneOverlaysRef.current.push({ circle, overlay })
    })
  }, [])

  // 경로 그리기
  const drawRouteOnMap = useCallback((routePath, start, dest) => {
    if (!mapInstance.current || !window.kakao || !routePath) return

    routePolylinesRef.current.forEach(p => p.setMap(null))
    routePolylinesRef.current = []
    routeMarkersRef.current.forEach(m => m.setMap(null))
    routeMarkersRef.current = []

    const linePath = routePath.map(point =>
      new window.kakao.maps.LatLng(point.latitude, point.longitude)
    )

    if (linePath.length === 0) return

    const polyline = new window.kakao.maps.Polyline({
      path: linePath,
      strokeWeight: 6,
      strokeColor: '#00E676',
      strokeOpacity: 0.85,
      strokeStyle: 'solid',
    })
    polyline.setMap(mapInstance.current)
    routePolylinesRef.current.push(polyline)

    if (start) {
      const startOverlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(start.lat, start.lng),
        content: `
          <div style="
            background:#00E676;border-radius:50%;
            width:36px;height:36px;
            display:flex;align-items:center;justify-content:center;
            color:#000;font-size:11px;font-weight:700;
            border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ">출발</div>
        `,
        yAnchor: 1,
      })
      startOverlay.setMap(mapInstance.current)
      routeMarkersRef.current.push(startOverlay)
    }

    if (dest) {
      const destOverlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(dest.lat, dest.lng),
        content: `
          <div style="
            background:#FF3B3B;border-radius:50%;
            width:36px;height:36px;
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-size:11px;font-weight:700;
            border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ">도착</div>
        `,
        yAnchor: 1,
      })
      destOverlay.setMap(mapInstance.current)
      routeMarkersRef.current.push(destOverlay)
    }

    const bounds = new window.kakao.maps.LatLngBounds()
    linePath.forEach(latlng => bounds.extend(latlng))
    mapInstance.current.setBounds(bounds)
  }, [])

  // 지도 초기화
  useEffect(() => {
    const initMap = () => {
      if (!window.kakao || !window.kakao.maps) return

      const container = mapRef.current
      const options = {
        center: new window.kakao.maps.LatLng(37.4979, 127.0276),
        level: 5,
      }
      mapInstance.current = new window.kakao.maps.Map(container, options)

      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map: mapInstance.current,
        averageCenter: true,
        minLevel: 5,
        disableClickZoom: false,
        styles: [{
          width: '44px', height: '44px',
          background: 'rgba(0,230,118,0.9)',
          borderRadius: '50%',
          color: '#000',
          textAlign: 'center',
          lineHeight: '44px',
          fontSize: '13px',
          fontWeight: '700',
          border: '2px solid #fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }],
      })

      fetchMarkerData().then(data => {
        allDataRef.current = data
        if (filters.cctv) renderCctvInBounds()
      })

      window.kakao.maps.event.addListener(mapInstance.current, 'idle', () => {
        if (filters.cctv) renderCctvInBounds()
      })

      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          const latlng = new window.kakao.maps.LatLng(latitude, longitude)
          // 검색으로 진입한 경우(다른 페이지에서 넘어옴)엔 현재 위치로 되돌리지 않는다
          if (!searchTargetRef.current) {
            mapInstance.current.setCenter(latlng)
            mapInstance.current.setLevel(5)
          }

          const content = `
            <div style="position:relative;width:24px;height:24px;">
              <div style="
                position:absolute;top:50%;left:50%;
                transform:translate(-50%,-50%);
                width:24px;height:24px;border-radius:50%;
                background:rgba(66,133,244,0.2);
                animation:pulse 2s infinite;
              "></div>
              <div style="
                position:absolute;top:50%;left:50%;
                transform:translate(-50%,-50%);
                width:14px;height:14px;border-radius:50%;
                background:#4285F4;border:2px solid #fff;
                box-shadow:0 2px 6px rgba(0,0,0,0.3);
              "></div>
              <style>
                @keyframes pulse {
                  0% { transform:translate(-50%,-50%) scale(1); opacity:1; }
                  100% { transform:translate(-50%,-50%) scale(2.5); opacity:0; }
                }
              </style>
            </div>
          `
          const locationOverlay = new window.kakao.maps.CustomOverlay({
            position: latlng, content, yAnchor: 0.5, xAnchor: 0.5,
          })
          locationOverlay.setMap(mapInstance.current)
          locationMarkerRef.current = locationOverlay
        },
        (error) => console.log('위치 권한 없음:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }

    if (window.kakao && window.kakao.maps) {
      initMap()
    } else {
      const check = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          clearInterval(check)
          initMap()
        }
      }, 300)
      return () => clearInterval(check)
    }
  }, [renderCctvInBounds])

  // 필터 변경 시
  useEffect(() => {
    if (!clustererRef.current) return
    if (filters.cctv) {
      renderCctvInBounds()
    } else {
      clustererRef.current.clear()
    }
  }, [filters, renderCctvInBounds])

  // 위험구역 변경 시
  useEffect(() => {
    if (mapInstance.current) {
      drawDangerZones(dangerZones)
    }
  }, [dangerZones, drawDangerZones])

  // 경로 안내에서 넘어온 경우
  useEffect(() => {
    if (routeState?.routePath && mapInstance.current) {
      drawRouteOnMap(routeState.routePath, routeState.start, routeState.dest)
    }
  }, [routeState, drawRouteOnMap])

  // 컨테이너 크기 변화(우측 패널 접기/펼치기, 창 리사이즈) 시 지도 다시 그리기
  useEffect(() => {
    if (!mapRef.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!mapInstance.current) return
      requestAnimationFrame(() => {
        mapInstance.current.relayout()
        if (filters?.cctv) renderCctvInBounds()
      })
    })
    ro.observe(mapRef.current)
    return () => ro.disconnect()
  }, [filters, renderCctvInBounds])

  // 상단 장소 검색에서 선택한 위치로 이동 + 핀 표시
  useEffect(() => {
    searchTargetRef.current = searchTarget
    if (!searchTarget || !mapInstance.current || !window.kakao) return
    const latlng = new window.kakao.maps.LatLng(searchTarget.lat, searchTarget.lng)
    mapInstance.current.setLevel(3)
    mapInstance.current.setCenter(latlng)

    searchMarkerRef.current?.setMap(null)
    const content = `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px);">
        <div style="background:#2563EB;color:#fff;padding:5px 11px;border-radius:16px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(37,99,235,0.4);">${iconSvg('map-pin', { size: 13, color: '#fff' })} ${searchTarget.name ?? '검색 위치'}</div>
        <div style="width:2px;height:9px;background:#2563EB;"></div>
      </div>
    `
    const overlay = new window.kakao.maps.CustomOverlay({ position: latlng, content, yAnchor: 1 })
    overlay.setMap(mapInstance.current)
    searchMarkerRef.current = overlay
  }, [searchTarget])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* 경로 안내 배너 — 모바일에서는 좌상단 레이어 칩과 같은 높이에 놓으면 겹치므로 칩 아래로 내린다 */}
      {routeState?.routeActive && (
        <div style={{
          position: 'absolute', top: isMobile ? 16 + CHIP_H + 10 : 16, left: '50%',
          transform: 'translateX(-50%)', zIndex: 10,
          background: 'var(--blue-primary)',
          borderRadius: '20px', padding: isMobile ? '6px 13px' : '8px 18px',
          color: '#fff', fontSize: isMobile ? 11.5 : 13, fontWeight: 700,
          boxShadow: 'var(--shadow)', whiteSpace: 'nowrap',
        }}>
          <Icon name="compass" size={isMobile ? 13 : 15} /> 경로 안내 중 · CCTV {routeState.safetyScore}개 경유
        </div>
      )}

      {/* 레이어 칩 (좌상단) */}
      <div style={{ position: 'absolute', top: 16, left: isMobile ? 12 : 16, zIndex: 10, display: 'flex', gap: isMobile ? 6 : 8 }}>
        {[
          { key: 'cctv', icon: 'camera', label: 'CCTV' },
          { key: 'streetLamp', icon: 'lightbulb', label: '가로등' },
          { key: 'safeZone', icon: 'shield-check', label: '안전구역' },
        ].map(ly => {
          const on = !!filters?.[ly.key]
          return (
            <button
              key={ly.key}
              onClick={() => onToggleFilter?.(ly.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6,
                height: CHIP_H, padding: isMobile ? '0 9px' : '0 13px',
                borderRadius: 20, fontSize: isMobile ? 11 : 12.5, fontWeight: 600, cursor: 'pointer',
                boxShadow: 'var(--shadow)', whiteSpace: 'nowrap',
                border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                background: on ? 'var(--blue-primary)' : 'var(--surface)',
                color: on ? '#fff' : 'var(--text-muted)', fontFamily: 'inherit',
              }}
            >
              <Icon name={ly.icon} size={isMobile ? 13 : 15} /><span>{ly.label}</span>
            </button>
          )
        })}
      </div>

      {/* 줌 컨트롤 (우하단) */}
      <div style={{
        position: 'absolute', bottom: 'calc(20px + var(--ls-sheet-peek, 0px))', right: 20, zIndex: 10, display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, overflow: 'hidden', boxShadow: 'var(--shadow)',
      }}>
        {['+', '−'].map((btn, i) => (
          <button
            key={btn}
            style={{
              width: 40, height: 40, border: 'none', borderBottom: i === 0 ? '1px solid var(--border)' : 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 19, color: 'var(--text-strong)',
            }}
            onClick={() => {
              if (!mapInstance.current) return
              const level = mapInstance.current.getLevel()
              mapInstance.current.setLevel(btn === '+' ? level - 1 : level + 1)
            }}
          >
            {btn}
          </button>
        ))}
      </div>

      {/* 현재 위치 버튼 (줌 위) */}
      <button
        title="현재 위치로"
        style={{
          position: 'absolute', bottom: 'calc(108px + var(--ls-sheet-peek, 0px))', right: 20, zIndex: 10,
          width: 40, height: 40, borderRadius: 11,
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--blue-primary)', cursor: 'pointer', boxShadow: 'var(--shadow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => {
          navigator.geolocation?.getCurrentPosition(pos => {
            if (!mapInstance.current) return
            const latlng = new window.kakao.maps.LatLng(
              pos.coords.latitude, pos.coords.longitude
            )
            mapInstance.current.setCenter(latlng)
          })
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}