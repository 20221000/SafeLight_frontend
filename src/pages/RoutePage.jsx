import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar'
import SidebarToggleBtn from '../components/Sidebar/SidebarToggleBtn'
import { useNavigation } from '../hooks/useNavigation'
import { useSidebar } from '../hooks/useSidebar'

export default function RoutePage({ user, onLogout }) {
  const navigate = useNavigate()
  const handleNavigate = useNavigation()
  const { sidebarOpen, setSidebarOpen } = useSidebar()
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const polylinesRef = useRef([])
  const clustererRef = useRef(null)
  const kakaoMarkersRef = useRef([])

  const [startMode, setStartMode] = useState('current')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [startSearch, setStartSearch] = useState('')
  const [startResult, setStartResult] = useState([])
  const [selectedStart, setSelectedStart] = useState(null)

  const [destMode, setDestMode] = useState('search')
  const [destSearch, setDestSearch] = useState('')
  const [destResult, setDestResult] = useState([])
  const [selectedDest, setSelectedDest] = useState(null)

  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [isSearched, setIsSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bookmarks, setBookmarks] = useState([])

  const token = localStorage.getItem('accessToken')
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    const initMap = () => {
      if (!window.kakao || !window.kakao.maps) return
      const container = mapRef.current
      const options = {
        center: new window.kakao.maps.LatLng(37.4979, 127.0276),
        level: 4,
      }
      mapInstance.current = new window.kakao.maps.Map(container, options)

      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map: mapInstance.current,
        averageCenter: true,
        minLevel: 5,
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

      fetch('/cctvs')
        .then(r => r.json())
        .then(json => {
          if (!json.success) return
          kakaoMarkersRef.current = json.data.map(item =>
            new window.kakao.maps.Marker({
              position: new window.kakao.maps.LatLng(item.latitude, item.longitude),
            })
          )
          clustererRef.current.addMarkers(kakaoMarkersRef.current)
        })
        .catch(err => console.error('CCTV 로드 실패:', err))
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
  }, [])

  useEffect(() => {
    if (startMode === 'current') {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setCurrentLocation({ lat: latitude, lng: longitude })
          setSelectedStart({ lat: latitude, lng: longitude, name: '현재 위치' })
          if (mapInstance.current) {
            const latlng = new window.kakao.maps.LatLng(latitude, longitude)
            mapInstance.current.setCenter(latlng)
            mapInstance.current.setLevel(4)
            addMarker(latlng, '출발', '#00E676')
          }
        },
        () => setCurrentLocation(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }
  }, [startMode])

  useEffect(() => {
    fetchBookmarks()
  }, [])

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('/bookmarks', { headers: authHeader })
      const json = await res.json()
      if (json.success) setBookmarks(json.data ?? [])
    } catch (err) {
      console.error('북마크 조회 실패:', err)
    }
  }

  const searchPlace = (keyword, setResult) => {
    if (!keyword.trim() || !window.kakao) return
    const ps = new window.kakao.maps.services.Places()
    ps.keywordSearch(keyword, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        setResult(data.slice(0, 4).map(p => ({
          name: p.place_name,
          address: p.road_address_name || p.address_name,
          lat: parseFloat(p.y),
          lng: parseFloat(p.x),
        })))
      }
    })
  }

  const clearMarkers = () => {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
  }

  const clearPolylines = () => {
    polylinesRef.current.forEach(p => p.setMap(null))
    polylinesRef.current = []
  }

  const addMarker = (latlng, label, color) => {
    if (!mapInstance.current) return
    const content = `
      <div style="
        background:${color};border-radius:50%;
        width:36px;height:36px;
        display:flex;align-items:center;justify-content:center;
        color:#000;font-size:11px;font-weight:700;
        border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
      ">${label}</div>
    `
    const overlay = new window.kakao.maps.CustomOverlay({
      position: latlng, content, yAnchor: 1,
    })
    overlay.setMap(mapInstance.current)
    markersRef.current.push(overlay)
  }

  const handleSelectStart = (place) => {
    setSelectedStart(place)
    setStartResult([])
    setStartSearch(place.name)
    if (mapInstance.current) {
      clearMarkers()
      const latlng = new window.kakao.maps.LatLng(place.lat, place.lng)
      mapInstance.current.setCenter(latlng)
      addMarker(latlng, '출발', '#00E676')
      if (selectedDest) {
        addMarker(
          new window.kakao.maps.LatLng(selectedDest.lat, selectedDest.lng),
          '도착', '#FF3B3B'
        )
      }
    }
  }

  const handleSelectDest = (place) => {
    setSelectedDest(place)
    setDestResult([])
    setDestSearch(place.name)
    if (mapInstance.current) {
      clearMarkers()
      if (selectedStart) {
        addMarker(
          new window.kakao.maps.LatLng(selectedStart.lat, selectedStart.lng),
          '출발', '#00E676'
        )
      }
      const destLatlng = new window.kakao.maps.LatLng(place.lat, place.lng)
      addMarker(destLatlng, '도착', '#FF3B3B')
      mapInstance.current.setCenter(destLatlng)
    }
  }

  const handleSearchRoute = async () => {
    if (!selectedStart || !selectedDest) {
      alert('출발지와 도착지를 설정해주세요.')
      return
    }

    setLoading(true)
    try {
      const offsets = [
        { dLat: 0,       dLng: 0 },
        { dLat: 0.0003,  dLng: 0.0003 },
        { dLat: -0.0003, dLng: 0.0003 },
      ]

      const results = await Promise.all(
        offsets.map((offset, idx) =>
          fetch('/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({
              startLatitude:  selectedStart.lat + offset.dLat,
              startLongitude: selectedStart.lng + offset.dLng,
              endLatitude:    selectedDest.lat,
              endLongitude:   selectedDest.lng,
            }),
          })
          .then(r => r.json())
          .then(json => {
            if (json.success && json.data?.[0]) {
              return { ...json.data[0], routeId: idx + 1 }
            }
            return null
          })
          .catch(() => null)
        )
      )

      const validRoutes = results.filter(Boolean)

      if (validRoutes.length === 0) {
        alert('경로를 찾을 수 없습니다.')
        return
      }

      validRoutes.sort((a, b) => b.safetyScore - a.safetyScore)

      const labeled = validRoutes.map((r, idx) => ({
        ...r,
        routeId: idx + 1,
        label: idx === 0 ? '추천' : `경로 ${idx + 1}`,
      }))

      setRoutes(labeled)
      setSelectedRoute(labeled[0])
      setIsSearched(true)
      drawRoute(labeled[0])

    } catch (err) {
      console.error('경로 검색 실패:', err)
      alert('경로 검색에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const drawRoute = (route) => {
    if (!mapInstance.current || !route?.path) return

    clearPolylines()
    clearMarkers()

    const linePath = route.path.map(point =>
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
    polylinesRef.current.push(polyline)

    if (selectedStart) {
      addMarker(
        new window.kakao.maps.LatLng(selectedStart.lat, selectedStart.lng),
        '출발', '#00E676'
      )
    }
    if (selectedDest) {
      addMarker(
        new window.kakao.maps.LatLng(selectedDest.lat, selectedDest.lng),
        '도착', '#FF3B3B'
      )
    }

    const bounds = new window.kakao.maps.LatLngBounds()
    linePath.forEach(latlng => bounds.extend(latlng))
    mapInstance.current.setBounds(bounds)
  }

  const handleBookmarkSave = async () => {
    if (!selectedRoute || !selectedStart || !selectedDest) return
    try {
      const res = await fetch('/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          routeName: `${selectedStart.name} → ${selectedDest.name}`,
          startLatitude: selectedStart.lat,
          startLongitude: selectedStart.lng,
          endLatitude: selectedDest.lat,
          endLongitude: selectedDest.lng,
          safetyScore: selectedRoute.safetyScore,
        }),
      })
      const json = await res.json()
      if (json.success) {
        alert('북마크에 저장되었습니다.')
        fetchBookmarks()
      }
    } catch (err) {
      alert('저장에 실패했습니다.')
    }
  }

  const handleBookmarkDelete = async (id) => {
    if (!window.confirm('북마크를 삭제할까요?')) return
    try {
      await fetch(`/bookmarks/${id}`, { method: 'DELETE', headers: authHeader })
      fetchBookmarks()
    } catch (err) {
      alert('삭제에 실패했습니다.')
    }
  }

  const handleBookmarkRoute = (bookmark) => {
    const start = {
      lat: bookmark.startLatitude,
      lng: bookmark.startLongitude,
      name: bookmark.routeName.split(' → ')[0] ?? '출발지',
    }
    const dest = {
      lat: bookmark.endLatitude,
      lng: bookmark.endLongitude,
      name: bookmark.routeName.split(' → ')[1] ?? '도착지',
    }
    setSelectedStart(start)
    setSelectedDest(dest)
    setStartSearch(start.name)
    setDestSearch(dest.name)
    setStartMode('search')

    if (mapInstance.current) {
      clearMarkers()
      addMarker(new window.kakao.maps.LatLng(start.lat, start.lng), '출발', '#00E676')
      addMarker(new window.kakao.maps.LatLng(dest.lat, dest.lng), '도착', '#FF3B3B')
    }
  }

  const scoreColor = (score) => {
    if (score >= 20) return '#00E676'
    if (score >= 10) return '#FFD600'
    return '#FF3B3B'
  }

  const s = styles

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      overflow: 'hidden', backgroundColor: '#0D1117', position: 'relative',
    }}>
      <Sidebar
        filters={{ cctv: true, streetLamp: true, safeZone: true }}
        onFilterChange={() => {}}
        user={user}
        onLogout={onLogout}
        onGoLogin={() => navigate('/login')}
        onNavigate={handleNavigate}
        activePage="route"
        isOpen={sidebarOpen}
      />
      <SidebarToggleBtn isOpen={sidebarOpen} onClick={() => setSidebarOpen(prev => !prev)} />

      {/* 좌측 패널 */}
      <div style={s.formPanel}>
        <div style={s.scrollArea}>

          {/* 출발지 */}
          <div style={s.card}>
            <div style={s.cardTitle}>① 출발지</div>
            <div style={s.modeRow}>
              <button
                style={{ ...s.modeBtn, ...(startMode === 'current' ? s.modeBtnActive : {}) }}
                onClick={() => { setStartMode('current'); setStartResult([]) }}
              >
                📍 현재 위치
              </button>
              <button
                style={{ ...s.modeBtn, ...(startMode === 'search' ? s.modeBtnActive : {}) }}
                onClick={() => setStartMode('search')}
              >
                🔍 직접 검색
              </button>
            </div>

            {startMode === 'current' && (
              <div style={s.locationStatus}>
                {currentLocation ? (
                  <>
                    <span style={s.greenDot} />
                    <div>
                      <div style={{ color: '#00E676', fontSize: '13px', fontWeight: '600' }}>
                        현재 위치 확인됨
                      </div>
                      <div style={{ color: '#A0AEC0', fontSize: '11px', marginTop: '2px' }}>
                        위도 {currentLocation.lat.toFixed(4)} · 경도 {currentLocation.lng.toFixed(4)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ ...s.greenDot, backgroundColor: '#FFD600' }} />
                    <div style={{ color: '#A0AEC0', fontSize: '13px' }}>
                      현재 위치를 가져오는 중...
                    </div>
                  </>
                )}
              </div>
            )}

            {startMode === 'search' && (
              <div>
                <input
                  style={s.searchInput}
                  placeholder="출발지 검색..."
                  value={startSearch}
                  onChange={e => {
                    setStartSearch(e.target.value)
                    searchPlace(e.target.value, setStartResult)
                  }}
                />
                {startResult.length > 0 && (
                  <div style={s.resultList}>
                    {startResult.map((place, idx) => (
                      <div key={idx} style={s.resultItem} onClick={() => handleSelectStart(place)}>
                        <span style={{ color: '#00E676' }}>📍</span>
                        <div>
                          <div style={s.resultName}>{place.name}</div>
                          <div style={s.resultAddr}>{place.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 도착지 */}
          <div style={s.card}>
            <div style={s.cardTitle}>② 도착지</div>
            <div style={s.tabRow}>
              <button
                style={{ ...s.tab, ...(destMode === 'bookmark' ? s.tabActive : {}) }}
                onClick={() => setDestMode('bookmark')}
              >
                ⭐ 북마크
              </button>
              <button
                style={{ ...s.tab, ...(destMode === 'search' ? s.tabActive : {}) }}
                onClick={() => setDestMode('search')}
              >
                🔍 직접 검색
              </button>
            </div>

            {destMode === 'bookmark' && (
              <div>
                {bookmarks.length > 0 ? (
                  bookmarks.map(bm => (
                    <div key={bm.id} style={s.placeItem} onClick={() => handleBookmarkRoute(bm)}>
                      <span style={{ fontSize: '18px' }}>⭐</span>
                      <div style={{ flex: 1 }}>
                        <div style={s.placeName}>{bm.routeName}</div>
                        <div style={s.placeAddr}>CCTV {bm.safetyScore}개</div>
                      </div>
                      <button
                        style={s.removeBtn}
                        onClick={e => { e.stopPropagation(); handleBookmarkDelete(bm.id) }}
                      >✕</button>
                    </div>
                  ))
                ) : (
                  <div style={s.emptySmall}>저장된 북마크가 없습니다.</div>
                )}
              </div>
            )}

            {destMode === 'search' && (
              <div>
                <input
                  style={s.searchInput}
                  placeholder="도착지 검색..."
                  value={destSearch}
                  onChange={e => {
                    setDestSearch(e.target.value)
                    searchPlace(e.target.value, setDestResult)
                  }}
                />
                {destResult.length > 0 && (
                  <div style={s.resultList}>
                    {destResult.map((place, idx) => (
                      <div key={idx} style={s.resultItem} onClick={() => handleSelectDest(place)}>
                        <span style={{ color: '#FF3B3B' }}>📍</span>
                        <div>
                          <div style={s.resultName}>{place.name}</div>
                          <div style={s.resultAddr}>{place.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 경로 찾기 버튼 */}
          {!isSearched && (
            <button
              style={{ ...s.searchBtn, opacity: loading ? 0.7 : 1 }}
              onClick={handleSearchRoute}
              disabled={loading}
            >
              {loading ? '경로 탐색 중...' : '🔍 안전 경로 찾기'}
            </button>
          )}

          {/* 경로 결과 */}
          {isSearched && (
            <div style={s.card}>
              <div style={s.cardTitle}>③ 추천 경로</div>
              {routes.map((route, idx) => (
                <div
                  key={route.routeId}
                  style={{
                    ...s.routeCard,
                    ...(selectedRoute?.routeId === route.routeId ? s.routeCardActive : {}),
                  }}
                  onClick={() => {
                    setSelectedRoute(route)
                    drawRoute(route)
                  }}
                >
                  <div style={s.routeTop}>
                    <span style={s.routeName}>경로 {idx + 1}</span>
                    {idx === 0 && <span style={s.recommendBadge}>추천</span>}
                    <span style={{ ...s.scoreText, color: scoreColor(route.safetyScore) }}>
                      CCTV {route.safetyScore}개
                    </span>
                  </div>
                  <div style={s.routeScoreBar}>
                    <div style={{
                      height: '4px', borderRadius: '2px',
                      backgroundColor: scoreColor(route.safetyScore),
                      width: `${Math.min(route.safetyScore * 2, 100)}%`,
                      transition: 'width 0.4s',
                    }} />
                  </div>
                  <div style={s.routeDesc}>{route.description}</div>
                </div>
              ))}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <button
                  style={s.startBtn}
                  onClick={() => {
                    if (!selectedRoute) return
                    navigate('/', {
                      state: {
                        routeActive: true,
                        routePath: selectedRoute.path,
                        start: selectedStart,
                        dest: selectedDest,
                        safetyScore: selectedRoute.safetyScore,
                      }
                    })
                  }}
                >
                  ▶ 지도에서 경로 보기
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={s.bookmarkBtn} onClick={handleBookmarkSave}>
                    ⭐ 북마크 저장
                  </button>
                  <button
                    style={s.resetBtn}
                    onClick={() => {
                      setIsSearched(false)
                      setRoutes([])
                      setSelectedRoute(null)
                      clearPolylines()
                      clearMarkers()
                      setSelectedStart(null)
                      setSelectedDest(null)
                      setStartSearch('')
                      setDestSearch('')
                      setStartMode('current')
                    }}
                  >
                    🔄 다시 검색
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 지도 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {selectedRoute && (
          <div style={s.safetyCard}>
            <div style={s.safetyTitle}>선택 경로 안전도</div>
            <div style={{ ...s.safetyScore, color: scoreColor(selectedRoute.safetyScore) }}>
              CCTV {selectedRoute.safetyScore}개
            </div>
            <div style={s.safetyDesc}>{selectedRoute.description}</div>
          </div>
        )}

        <div style={s.zoomControl}>
          {['+', '−'].map(btn => (
            <button key={btn} style={s.zoomBtn} onClick={() => {
              if (!mapInstance.current) return
              const level = mapInstance.current.getLevel()
              mapInstance.current.setLevel(btn === '+' ? level - 1 : level + 1)
            }}>{btn}</button>
          ))}
        </div>

        <button
          style={s.myLocationBtn}
          onClick={() => {
            if (currentLocation && mapInstance.current) {
              mapInstance.current.setCenter(
                new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng)
              )
            }
          }}
        >
          🎯
        </button>
      </div>
    </div>
  )
}

const styles = {
  formPanel: {
    width: '360px', flexShrink: 0, height: '100vh',
    backgroundColor: '#0D1117', borderRight: '1px solid #1E2535',
    display: 'flex', flexDirection: 'column',
  },
  scrollArea: {
    flex: 1, overflowY: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  card: {
    backgroundColor: '#161B27', borderRadius: '12px',
    padding: '16px', border: '1px solid #1E2535',
  },
  cardTitle: { color: '#fff', fontSize: '14px', fontWeight: '700', marginBottom: '12px' },
  modeRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
  modeBtn: {
    flex: 1, padding: '10px', borderRadius: '8px',
    backgroundColor: '#0D1117', border: '1px solid #2D3748',
    color: '#A0AEC0', fontSize: '13px', cursor: 'pointer',
  },
  modeBtnActive: {
    backgroundColor: '#00E676', border: '1px solid #00E676',
    color: '#000', fontWeight: '700',
  },
  locationStatus: {
    display: 'flex', alignItems: 'center', gap: '10px',
    backgroundColor: '#0D1117', borderRadius: '8px',
    padding: '10px 12px', border: '1px solid #1E2535',
  },
  greenDot: {
    width: '10px', height: '10px', borderRadius: '50%',
    backgroundColor: '#00E676', flexShrink: 0,
    boxShadow: '0 0 6px #00E676',
  },
  searchInput: {
    width: '100%', backgroundColor: '#0D1117',
    border: '1px solid #2D3748', borderRadius: '8px',
    padding: '10px 14px', color: '#fff', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box', marginBottom: '4px',
  },
  resultList: {
    backgroundColor: '#0D1117', border: '1px solid #1E2535',
    borderRadius: '8px', overflow: 'hidden',
  },
  resultItem: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '10px 12px', cursor: 'pointer',
    borderBottom: '1px solid #1E2535',
  },
  resultName: { color: '#fff', fontSize: '13px', fontWeight: '600' },
  resultAddr: { color: '#A0AEC0', fontSize: '11px', marginTop: '2px' },
  tabRow: {
    display: 'flex', marginBottom: '12px',
    borderBottom: '1px solid #1E2535',
  },
  tab: {
    flex: 1, padding: '8px', background: 'none', border: 'none',
    color: '#A0AEC0', fontSize: '13px', cursor: 'pointer',
    borderBottom: '2px solid transparent', marginBottom: '-1px',
  },
  tabActive: { color: '#00E676', borderBottom: '2px solid #00E676', fontWeight: '700' },
  placeItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 8px', borderRadius: '8px', cursor: 'pointer',
    marginBottom: '4px',
  },
  placeName: { color: '#fff', fontSize: '13px', fontWeight: '600' },
  placeAddr: { color: '#A0AEC0', fontSize: '11px', marginTop: '2px' },
  removeBtn: {
    background: 'none', border: 'none',
    color: '#A0AEC0', fontSize: '14px', cursor: 'pointer',
  },
  emptySmall: {
    color: '#A0AEC0', fontSize: '13px',
    textAlign: 'center', padding: '20px 0',
  },
  searchBtn: {
    width: '100%', backgroundColor: '#00E676', border: 'none',
    borderRadius: '10px', padding: '14px',
    color: '#000', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
  },
  routeCard: {
    backgroundColor: '#0D1117', borderRadius: '10px',
    padding: '12px', border: '1px solid #1E2535',
    marginBottom: '8px', cursor: 'pointer',
  },
  routeCardActive: { border: '1px solid #00E676', backgroundColor: 'rgba(0,230,118,0.05)' },
  routeTop: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  routeName: { color: '#fff', fontSize: '14px', fontWeight: '700', flex: 1 },
  recommendBadge: {
    backgroundColor: '#00E676', color: '#000',
    fontSize: '10px', fontWeight: '700',
    padding: '2px 8px', borderRadius: '4px',
  },
  scoreText: { fontSize: '13px', fontWeight: '700' },
  routeScoreBar: {
    width: '100%', height: '4px', backgroundColor: '#1E2535',
    borderRadius: '2px', marginBottom: '8px', overflow: 'hidden',
  },
  routeDesc: { color: '#A0AEC0', fontSize: '12px' },
  startBtn: {
    width: '100%', backgroundColor: '#00E676', border: 'none',
    borderRadius: '8px', padding: '12px',
    color: '#000', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
  },
  bookmarkBtn: {
    flex: 1, backgroundColor: 'transparent',
    border: '1px solid #00E676', borderRadius: '8px',
    padding: '10px', color: '#00E676',
    fontWeight: '600', fontSize: '13px', cursor: 'pointer',
  },
  resetBtn: {
    flex: 1, backgroundColor: 'transparent',
    border: '1px solid #2D3748', borderRadius: '8px',
    padding: '10px', color: '#A0AEC0',
    fontWeight: '600', fontSize: '13px', cursor: 'pointer',
  },
  safetyCard: {
    position: 'absolute', top: '16px', right: '60px', zIndex: 10,
    backgroundColor: '#161B27', borderRadius: '12px',
    padding: '16px', border: '1px solid #1E2535', minWidth: '160px',
  },
  safetyTitle: { color: '#A0AEC0', fontSize: '11px', marginBottom: '4px' },
  safetyScore: { fontSize: '22px', fontWeight: '800', marginBottom: '6px' },
  safetyDesc: { color: '#A0AEC0', fontSize: '11px', lineHeight: '1.5' },
  zoomControl: {
    position: 'absolute', top: '16px', right: '16px',
    zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px',
  },
  zoomBtn: {
    width: '36px', height: '36px',
    backgroundColor: '#161B27', border: '1px solid #2D3748',
    borderRadius: '6px', color: '#fff', fontSize: '18px', cursor: 'pointer',
  },
  myLocationBtn: {
    position: 'absolute', bottom: '32px', right: '16px',
    zIndex: 10, width: '44px', height: '44px', borderRadius: '50%',
    backgroundColor: '#161B27', border: '1px solid #2D3748',
    color: '#fff', fontSize: '20px', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
}