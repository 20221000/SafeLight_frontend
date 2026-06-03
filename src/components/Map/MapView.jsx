import { useEffect, useRef, useCallback } from 'react'

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

export default function MapView({ filters, dangerZones = [], routeState = null }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const clustererRef = useRef(null)
  const allDataRef = useRef({ cctv: [], streetLamp: [], safeZone: [] })
  const locationMarkerRef = useRef(null)
  const dangerZoneOverlaysRef = useRef([])
  const routePolylinesRef = useRef([])
  const routeMarkersRef = useRef([])

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
      HIGH:   { stroke: '#FF3B3B' },
      MEDIUM: { stroke: '#FF9500' },
      LOW:    { stroke: '#FFD600' },
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
        ">⚠️ ${zone.dangerLevel}</div>
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
          mapInstance.current.setCenter(latlng)
          mapInstance.current.setLevel(5)

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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {routeState?.routeActive && (
        <div style={{
          position: 'absolute', top: '70px', left: '50%',
          transform: 'translateX(-50%)', zIndex: 10,
          backgroundColor: 'rgba(0,230,118,0.95)',
          borderRadius: '20px', padding: '8px 20px',
          color: '#000', fontSize: '13px', fontWeight: '700',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          🧭 경로 안내 중 · CCTV {routeState.safetyScore}개 경유
        </div>
      )}

      {/* 상단 검색바 */}
      <div style={{
        position: 'absolute', top: '16px', left: '50%',
        transform: 'translateX(-50%)', zIndex: 10, width: '400px',
      }}>
        <div style={{
          backgroundColor: '#fff', borderRadius: '24px',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}>
          <span style={{ color: '#999', fontSize: '16px' }}>🔍</span>
          <input
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: '13px', color: '#333', backgroundColor: 'transparent',
            }}
            placeholder="위치, 장소 검색..."
          />
        </div>
      </div>

      {/* 범례 */}
      <div style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        backgroundColor: 'rgba(13,17,23,0.9)',
        borderRadius: '8px', padding: '10px 12px', border: '1px solid #1E2535',
      }}>
        {[
          { color: '#00E676', icon: '📷', label: 'CCTV' },
          { color: '#FFD600', icon: '💡', label: '가로등' },
          { color: '#00C853', icon: '🏪', label: '편의점' },
          { color: '#FF3B3B', icon: '⚠️', label: '위험구역' },
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px',
          }}>
            <span style={{
              width: '16px', height: '16px', borderRadius: '50%',
              backgroundColor: item.color, fontSize: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {item.icon}
            </span>
            <span style={{ color: '#fff', fontSize: '11px' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* 줌 컨트롤 */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        {['+', '−'].map(btn => (
          <button
            key={btn}
            style={{
              width: '36px', height: '36px',
              backgroundColor: '#161B27', border: '1px solid #2D3748',
              borderRadius: '6px', color: '#fff', fontSize: '18px', cursor: 'pointer',
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

      {/* 현재 위치 버튼 */}
      <button
        style={{
          position: 'absolute', bottom: '32px', right: '16px', zIndex: 10,
          width: '40px', height: '40px', borderRadius: '50%',
          backgroundColor: '#161B27', border: '1px solid #2D3748',
          color: '#fff', fontSize: '18px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
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
        🎯
      </button>
    </div>
  )
}