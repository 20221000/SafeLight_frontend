import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import useIsMobile from '../hooks/useIsMobile'
import Icon from '../components/Icon'
import useDragSheet from '../hooks/useDragSheet'
import useSheetHeadHeight from '../hooks/useSheetHeadHeight'
import { SHEET_COLLAPSED } from '../components/layout/BottomSheet'
import { readEnvelope } from '../utils/apiResponse'
import { saveActiveRoute } from '../utils/activeRoute'

const START_COLOR = '#2563EB'
const DEST_COLOR = '#E11D48'

export default function RoutePage({ user, onLogout }) {
  const navigate = useNavigate()
  // 모바일(M4): 좌측 360px 패널이 화면을 다 먹으므로 지도 위 바텀시트로 전환한다(panelOpen = 시트 펼침).
  const isMobile = useIsMobile()
  const containerRef = useRef(null)
  const sheetRef = useRef(null)
  // mid = 핸들 + 제목 블록. 조금만 올리면 '안전 경로 안내' 제목까지만 보인다.
  const sheetMid = useSheetHeadHeight(sheetRef, { handle: SHEET_COLLAPSED, fallback: 128 })
  const {
    height: sheetH, dragging: sheetDragging, handleProps: sheetHandleProps,
    bodyProps: sheetBodyProps, isFull: sheetFull,
  } = useDragSheet(containerRef, {
    collapsed: SHEET_COLLAPSED, mid: sheetMid, fullRatio: 0.92, initial: 'mid',
  })
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const polylinesRef = useRef([])
  const clustererRef = useRef(null)
  const kakaoMarkersRef = useRef([])

  // 모바일에서는 바텀시트가 지도 아래쪽을 덮는다. 그냥 setCenter 하면 출발/도착 마커가 시트 뒤로 숨으므로,
  // 시트를 뺀 '실제로 보이는 영역'의 한가운데로 오도록 시트 높이의 절반만큼 지도를 밀어준다.
  // (시트를 끝까지 올린 상태에서는 지도가 어차피 안 보이므로 mid 높이까지만 보정한다)
  const visibleOffset = () => (isMobile ? Math.min(sheetH, sheetMid) : 0)

  // 최신 보정값은 ref로 넘긴다. centerOnVisible을 sheetH에 의존시키면 이 함수를 쓰는 effect가
  // 시트를 끌 때마다 다시 돌아 위치 조회를 반복하게 된다.
  const sheetOffsetRef = useRef(0)
  useEffect(() => { sheetOffsetRef.current = isMobile ? Math.min(sheetH, sheetMid) : 0 }, [isMobile, sheetH, sheetMid])

  const centerOnVisible = useCallback((latlng) => {
    const map = mapInstance.current
    if (!map) return
    map.setCenter(latlng)
    const off = sheetOffsetRef.current
    if (off) map.panBy(0, off / 2)
  }, [])

  const [startMode, setStartMode] = useState('current')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [startAddress, setStartAddress] = useState('') // 현재 위치의 사람이 읽는 주소 (역지오코딩)
  const [startSearch, setStartSearch] = useState('')
  const [startResult, setStartResult] = useState([])
  const [selectedStart, setSelectedStart] = useState(null)

  const [destMode, setDestMode] = useState('search')
  const [destSearch, setDestSearch] = useState('')
  const [destResult, setDestResult] = useState([])
  const [selectedDest, setSelectedDest] = useState(null)

  const [mapReady, setMapReady] = useState(false) // 카카오 지도 인스턴스 생성 완료 (마커 동기화 시점)
  const [pendingPlace, setPendingPlace] = useState(null) // 상단 검색에서 넘어온 장소 (출발/도착 선택 대기)
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [isSearched, setIsSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bookmarks, setBookmarks] = useState([])
  const [panelOpen, setPanelOpen] = useState(true) // 좌측 경로 안내 패널 열기/닫기

  const token = localStorage.getItem('accessToken')
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    const initMap = () => {
      if (!window.kakao || !window.kakao.maps) return
      const container = mapRef.current
      mapInstance.current = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(37.4979, 127.0276), level: 4,
      })
      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map: mapInstance.current, averageCenter: true, minLevel: 5,
        styles: [{
          width: '44px', height: '44px', background: 'rgba(37,99,235,0.9)', borderRadius: '50%',
          color: '#fff', textAlign: 'center', lineHeight: '44px', fontSize: '13px', fontWeight: '700',
          border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }],
      })
      setMapReady(true)
      fetch('/cctvs').then(readEnvelope).then(json => {
        if (!json.success || !json.data) return
        kakaoMarkersRef.current = json.data.map(item => new window.kakao.maps.Marker({ position: new window.kakao.maps.LatLng(item.latitude, item.longitude) }))
        clustererRef.current.addMarkers(kakaoMarkersRef.current)
      }).catch(err => console.error('CCTV 로드 실패:', err))
    }
    if (window.kakao && window.kakao.maps) initMap()
    else {
      const check = setInterval(() => { if (window.kakao && window.kakao.maps) { clearInterval(check); initMap() } }, 300)
      return () => clearInterval(check)
    }
  }, [])

  // 좌표 → 도로명(없으면 지번) 주소. 카카오 services 로 처리하므로 백엔드가 필요 없다.
  const reverseGeocode = useCallback((lat, lng) => new Promise((resolve) => {
    if (!window.kakao?.maps?.services) { resolve(''); return }
    const geocoder = new window.kakao.maps.services.Geocoder()
    geocoder.coord2Address(lng, lat, (result, status) => {
      if (status !== window.kakao.maps.services.Status.OK || !result?.length) { resolve(''); return }
      resolve(result[0].road_address?.address_name || result[0].address?.address_name || '')
    })
  }), [])

  useEffect(() => {
    if (startMode === 'current') {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setCurrentLocation({ lat: latitude, lng: longitude })
          setSelectedStart({ lat: latitude, lng: longitude, name: '현재 위치' })
          // 주소를 알아내면 출발지 이름도 주소로 바꾼다 — 북마크 routeName 이 '현재 위치 → …'
          // 처럼 나중에 알아볼 수 없는 이름으로 저장되는 걸 막는다.
          reverseGeocode(latitude, longitude).then(addr => {
            if (!addr) return
            setStartAddress(addr)
            setSelectedStart(prev => (prev && prev.lat === latitude && prev.lng === longitude ? { ...prev, name: addr } : prev))
          })
          if (mapInstance.current) {
            mapInstance.current.setLevel(4)
            centerOnVisible(new window.kakao.maps.LatLng(latitude, longitude))
          }
        },
        () => setCurrentLocation(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }
  }, [startMode, centerOnVisible, reverseGeocode])

  // 좌측 패널 접힘/펼침 등으로 지도 컨테이너 크기가 바뀌면 카카오 지도 relayout (안 하면 타일이 잘림)
  useEffect(() => {
    if (!mapRef.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!mapInstance.current) return
      requestAnimationFrame(() => mapInstance.current.relayout())
    })
    ro.observe(mapRef.current)
    return () => ro.disconnect()
  }, [])

  // 선언을 effect보다 앞에 둔다 — effect에서 아직 선언 전인 const 를 참조하면 안 된다.
  // authHeader 는 렌더마다 새 객체라 의존성으로 쓸 수 없어, 토큰에서 헤더를 직접 만든다.
  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/bookmarks', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const json = await readEnvelope(res)
      if (json.success) setBookmarks(json.data ?? [])
      else console.warn('북마크 조회 실패:', json.message)
    } catch (err) { console.error('북마크 조회 실패:', err) }
  }, [token])

  useEffect(() => { fetchBookmarks() }, [fetchBookmarks])

  const searchPlace = (keyword, setResult) => {
    if (!keyword.trim() || !window.kakao) return
    const ps = new window.kakao.maps.services.Places()
    ps.keywordSearch(keyword, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        setResult(data.slice(0, 4).map(p => ({ name: p.place_name, address: p.road_address_name || p.address_name, lat: parseFloat(p.y), lng: parseFloat(p.x) })))
      }
    })
  }

  const clearMarkers = useCallback(() => { markersRef.current.forEach(m => m.setMap(null)); markersRef.current = [] }, [])
  const clearPolylines = () => { polylinesRef.current.forEach(p => p.setMap(null)); polylinesRef.current = [] }

  const addMarker = useCallback((latlng, label, color) => {
    if (!mapInstance.current) return
    const content = `<div style="background:${color};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${label}</div>`
    const overlay = new window.kakao.maps.CustomOverlay({ position: latlng, content, yAnchor: 1 })
    overlay.setMap(mapInstance.current)
    markersRef.current.push(overlay)
  }, [])

  // 출발·도착 마커는 오직 여기서만 그린다. 선택 상태가 바뀔 때마다 전부 지우고 다시 찍으므로
  // 출발 1개 + 도착 1개가 보장된다.
  // (이전에는 핸들러와 위치조회 effect가 각자 addMarker 를 불러서, 현재위치↔직접검색을 오가거나
  //  위치 조회가 다시 돌 때마다 같은 자리에 마커가 겹겹이 쌓였다.)
  useEffect(() => {
    if (!mapReady) return
    clearMarkers()
    if (selectedStart) addMarker(new window.kakao.maps.LatLng(selectedStart.lat, selectedStart.lng), '출발', START_COLOR)
    if (selectedDest) addMarker(new window.kakao.maps.LatLng(selectedDest.lat, selectedDest.lng), '도착', DEST_COLOR)
  }, [mapReady, selectedStart, selectedDest, clearMarkers, addMarker])

  // '현재 위치'가 실제와 다를 때(GPS 오차·실내 등) 사용자가 직접 고칠 수 있게 한다.
  // 검색 모드로 넘기면서 지금 주소를 미리 채워 넣고 후보까지 띄워준다.
  const handleEditStart = () => {
    const seed = startAddress || startSearch
    setStartMode('search')
    setStartSearch(seed)
    if (seed) searchPlace(seed, setStartResult)
  }

  // 마커는 위 동기화 effect가 맡는다. 핸들러는 선택 상태와 지도 중심만 다룬다.
  const handleSelectStart = (place) => {
    setSelectedStart(place); setStartResult([]); setStartSearch(place.name)
    if (mapInstance.current) centerOnVisible(new window.kakao.maps.LatLng(place.lat, place.lng))
  }

  const handleSelectDest = (place) => {
    setSelectedDest(place); setDestResult([]); setDestSearch(place.name)
    if (mapInstance.current) centerOnVisible(new window.kakao.maps.LatLng(place.lat, place.lng))
  }

  // 상단 검색에서 장소를 고르면 출발/도착 선택 팝업을 띄운다
  const applyPendingAsStart = () => {
    if (!pendingPlace) return
    setStartMode('search')
    handleSelectStart(pendingPlace)
    setPendingPlace(null)
  }
  const applyPendingAsDest = () => {
    if (!pendingPlace) return
    setDestMode('search')
    handleSelectDest(pendingPlace)
    setPendingPlace(null)
  }

  const handleSearchRoute = async () => {
    if (!selectedStart || !selectedDest) { alert('출발지와 도착지를 설정해주세요.'); return }
    setLoading(true)
    try {
      const offsets = [{ dLat: 0, dLng: 0 }, { dLat: 0.0003, dLng: 0.0003 }, { dLat: -0.0003, dLng: 0.0003 }]
      const results = await Promise.all(offsets.map((offset, idx) =>
        fetch('/routes', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ startLatitude: selectedStart.lat + offset.dLat, startLongitude: selectedStart.lng + offset.dLng, endLatitude: selectedDest.lat, endLongitude: selectedDest.lng }),
        }).then(readEnvelope).then(json => (json.success && json.data?.[0]) ? { ...json.data[0], routeId: idx + 1, failMessage: null } : { failMessage: json.message }).catch(() => ({ failMessage: '서버에 연결하지 못했습니다.' }))
      ))
      const validRoutes = results.filter(r => r.routeId)
      if (validRoutes.length === 0) {
        // 전부 실패했으면 첫 실패 사유를 그대로 보여준다 ('경로 없음'과 '권한 없음'은 다르다).
        alert(results.find(r => r.failMessage)?.failMessage || '경로를 찾을 수 없습니다.')
        return
      }
      validRoutes.sort((a, b) => b.safetyScore - a.safetyScore)
      const labeled = validRoutes.map((r, idx) => ({ ...r, routeId: idx + 1, label: idx === 0 ? '추천' : `경로 ${idx + 1}` }))
      setRoutes(labeled); setSelectedRoute(labeled[0]); setIsSearched(true); drawRoute(labeled[0])
    } catch (err) {
      console.error('경로 검색 실패:', err); alert('경로 검색에 실패했습니다.')
    } finally { setLoading(false) }
  }

  const drawRoute = (route) => {
    if (!mapInstance.current || !route?.path) return
    clearPolylines() // 마커는 건드리지 않는다 — 동기화 effect가 이미 출발/도착 하나씩 유지 중이다.
    const linePath = route.path.map(point => new window.kakao.maps.LatLng(point.latitude, point.longitude))
    if (linePath.length === 0) return
    const polyline = new window.kakao.maps.Polyline({ path: linePath, strokeWeight: 6, strokeColor: START_COLOR, strokeOpacity: 0.9, strokeStyle: 'solid' })
    polyline.setMap(mapInstance.current); polylinesRef.current.push(polyline)
    const bounds = new window.kakao.maps.LatLngBounds()
    linePath.forEach(latlng => bounds.extend(latlng))
    // 아래쪽 패딩만큼 비워두면 경로 전체가 시트에 가리지 않고 들어온다.
    mapInstance.current.setBounds(bounds, 24, 24, 24 + visibleOffset(), 24)
  }

  const handleBookmarkSave = async () => {
    if (!selectedRoute || !selectedStart || !selectedDest) return
    try {
      const res = await fetch('/bookmarks', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ routeName: `${selectedStart.name} → ${selectedDest.name}`, startLatitude: selectedStart.lat, startLongitude: selectedStart.lng, endLatitude: selectedDest.lat, endLongitude: selectedDest.lng, safetyScore: selectedRoute.safetyScore }),
      })
      const json = await readEnvelope(res)
      if (json.success) { alert('북마크에 저장되었습니다.'); fetchBookmarks() }
      else alert(json.message || '저장에 실패했습니다.')
    } catch { alert('저장에 실패했습니다.') }
  }

  const handleBookmarkDelete = async (id) => {
    if (!window.confirm('북마크를 삭제할까요?')) return
    try { await fetch(`/bookmarks/${id}`, { method: 'DELETE', headers: authHeader }); fetchBookmarks() }
    catch { alert('삭제에 실패했습니다.') }
  }

  const handleBookmarkRoute = (bookmark) => {
    const start = { lat: bookmark.startLatitude, lng: bookmark.startLongitude, name: bookmark.routeName.split(' → ')[0] ?? '출발지' }
    const dest = { lat: bookmark.endLatitude, lng: bookmark.endLongitude, name: bookmark.routeName.split(' → ')[1] ?? '도착지' }
    setSelectedStart(start); setSelectedDest(dest); setStartSearch(start.name); setDestSearch(dest.name); setStartMode('search')
  }

  const scoreColor = (score) => (score >= 20 ? 'var(--safe)' : score >= 10 ? 'var(--warning)' : 'var(--danger)')

  return (
    <UserShell user={user} onLogout={onLogout} active="route" scroll={false} contentBg="var(--map-bg)" onPickPlace={setPendingPlace}>
      <div ref={containerRef} style={isMobile ? { position: 'relative', height: '100%' } : { display: 'flex', height: '100%' }}>
        {/* 모바일: 지도 위 드래그 바텀시트 / 데스크탑: 좌측 360px 패널(열기·닫기) */}
        <div ref={sheetRef} style={isMobile ? {
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 25, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', height: sheetH,
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
          boxShadow: '0 -4px 20px rgba(15,23,42,0.08)',
          transition: sheetDragging ? 'none' : 'height .24s ease',
        } : { flex: panelOpen ? '0 0 360px' : '0 0 0px', width: panelOpen ? 360 : 0, minWidth: 0, overflow: 'hidden', transition: 'width .3s ease, flex-basis .3s ease' }}>
          {/* 드래그 핸들 — 스크롤 영역 밖에 둬야 시트 이동과 본문 스크롤이 서로 안 먹는다 */}
          {isMobile && (
            <div
              {...sheetHandleProps}
              role="button"
              aria-label="경로 패널 크기 조절"
              style={{
                ...sheetHandleProps.style,
                flexShrink: 0, height: SHEET_COLLAPSED, minHeight: SHEET_COLLAPSED,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab',
              }}
            >
              <span style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
          )}
          {/* 모바일은 시트를 다 올렸을 때만 스크롤. 그 전에는 본문을 끌어도 시트가 올라간다. */}
          <div
            className="ls-scroll"
            {...(isMobile ? sheetBodyProps : {})}
            style={{
              ...(isMobile ? sheetBodyProps.style : {}),
              width: isMobile ? '100%' : 360, flex: isMobile ? 1 : undefined, minHeight: 0,
              height: isMobile ? undefined : '100%',
              overflowY: !isMobile || sheetFull ? 'auto' : 'hidden',
              background: 'var(--surface)', borderRight: isMobile ? 'none' : '1px solid var(--border)',
            }}
          >
          <div style={{ padding: isMobile ? '0 16px 16px' : 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* data-sheet-head: 모바일 바텀시트가 이 높이를 재서 mid(조금 올린 상태) 높이로 쓴다. */}
            <div data-sheet-head style={{ paddingTop: isMobile ? 2 : 0, paddingBottom: isMobile ? 10 : 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>안전 경로 안내</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>CCTV·가로등 밀집도로 안전한 길을 찾습니다</div>
            </div>

            {/* 출발지 */}
            <Card title="① 출발지">
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <ModeBtn active={startMode === 'current'} onClick={() => { setStartMode('current'); setStartResult([]) }}><Icon name="map-pin" size={14} /> 현재 위치</ModeBtn>
                <ModeBtn active={startMode === 'search'} onClick={() => setStartMode('search')}><Icon name="search" size={14} /> 직접 검색</ModeBtn>
              </div>
              {startMode === 'current' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: currentLocation ? 'var(--safe)' : 'var(--warning)', flexShrink: 0 }} />
                  {currentLocation ? (
                    <>
                      {/* minWidth:0 — 주소가 길어도 '수정' 버튼을 밀어내지 않게. */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--safe)', fontSize: 13, fontWeight: 600 }}>현재 위치 확인됨</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 2 }}>
                          {startAddress || `${currentLocation.lat.toFixed(4)} · ${currentLocation.lng.toFixed(4)}`}
                        </div>
                      </div>
                      <button
                        onClick={handleEditStart}
                        title="출발지 직접 지정"
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px',
                          border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)',
                          color: 'var(--blue-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <Icon name="edit" size={13} /> 수정
                      </button>
                    </>
                  ) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>현재 위치를 가져오는 중...</div>}
                </div>
              )}
              {startMode === 'search' && (
                <div>
                  <input style={inputStyle} placeholder="출발지 검색..." value={startSearch} onChange={e => { setStartSearch(e.target.value); searchPlace(e.target.value, setStartResult) }} />
                  {startResult.length > 0 && <ResultList list={startResult} onPick={handleSelectStart} color={START_COLOR} />}
                </div>
              )}
            </Card>

            {/* 도착지 */}
            <Card title="② 도착지">
              <div style={{ display: 'flex', marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <TabBtn active={destMode === 'bookmark'} onClick={() => setDestMode('bookmark')}><Icon name="star" size={14} /> 북마크</TabBtn>
                <TabBtn active={destMode === 'search'} onClick={() => setDestMode('search')}><Icon name="search" size={14} /> 직접 검색</TabBtn>
              </div>
              {destMode === 'bookmark' && (
                bookmarks.length > 0 ? bookmarks.map(bm => (
                  <div key={bm.id} onClick={() => handleBookmarkRoute(bm)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 10, cursor: 'pointer' }}>
                    <Icon name="star" size={18} color="var(--blue-primary)" />
                    {/* minWidth:0 — 긴 경로 이름이 삭제(✕) 버튼을 밀어내지 않게. */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{bm.routeName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CCTV {bm.safetyScore}개</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleBookmarkDelete(bm.id) }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}><Icon name="x" size={16} /></button>
                  </div>
                )) : <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>저장된 북마크가 없습니다.</div>
              )}
              {destMode === 'search' && (
                <div>
                  <input style={inputStyle} placeholder="도착지 검색..." value={destSearch} onChange={e => { setDestSearch(e.target.value); searchPlace(e.target.value, setDestResult) }} />
                  {destResult.length > 0 && <ResultList list={destResult} onPick={handleSelectDest} color={DEST_COLOR} />}
                </div>
              )}
            </Card>

            {!isSearched && (
              <button onClick={handleSearchRoute} disabled={loading} style={{ width: '100%', height: 48, border: 'none', borderRadius: 12, background: 'var(--blue-primary)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, boxShadow: '0 6px 16px rgba(37,99,235,.28)', fontFamily: 'inherit' }}>
                {loading ? '경로 탐색 중...' : <><Icon name="search" size={16} /> 안전 경로 찾기</>}
              </button>
            )}

            {isSearched && (
              <Card title="③ 추천 경로">
                {routes.map((route, idx) => {
                  const on = selectedRoute?.routeId === route.routeId
                  return (
                    <div key={route.routeId} onClick={() => { setSelectedRoute(route); drawRoute(route) }} style={{
                      borderRadius: 12, padding: 13, marginBottom: 8, cursor: 'pointer',
                      border: `1px solid ${on ? 'var(--blue-primary)' : 'var(--border)'}`, background: on ? 'var(--blue-tint)' : 'var(--bg)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>경로 {idx + 1}</span>
                        {idx === 0 && <span style={{ background: 'var(--blue-primary)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>추천</span>}
                        <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(route.safetyScore) }}>CCTV {route.safetyScore}개</span>
                      </div>
                      <div style={{ width: '100%', height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: 5, borderRadius: 3, background: scoreColor(route.safetyScore), width: `${Math.min(route.safetyScore * 2, 100)}%`, transition: 'width .4s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{route.description}</div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <button onClick={() => {
                    if (!selectedRoute) return
                    // 세션에 저장해 둬야 다른 화면에 갔다 와도 안내가 유지된다(취소는 지도 배너에서).
                    saveActiveRoute({ routePath: selectedRoute.path, start: selectedStart, dest: selectedDest, safetyScore: selectedRoute.safetyScore })
                    navigate('/')
                  }}
                    style={{ width: '100%', height: 44, border: 'none', borderRadius: 11, background: 'var(--blue-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><Icon name="play" size={15} /> 지도에서 경로 보기</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleBookmarkSave} style={{ flex: 1, height: 42, border: '1px solid var(--blue-primary)', borderRadius: 11, background: 'var(--surface)', color: 'var(--blue-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Icon name="star" size={15} /> 북마크 저장</button>
                    <button onClick={() => { setIsSearched(false); setRoutes([]); setSelectedRoute(null); clearPolylines(); setSelectedDest(null); setStartSearch(''); setDestSearch(''); setStartMode('current')
                        // 이미 'current' 모드면 위치조회 effect가 다시 돌지 않으므로, 알고 있는 현재 위치를 직접 되살린다.
                        setSelectedStart(currentLocation ? { ...currentLocation, name: startAddress || '현재 위치' } : null) }}
                      style={{ flex: 1, height: 42, border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Icon name="refresh" size={15} /> 다시 검색</button>
                  </div>
                </div>
              </Card>
            )}
          </div>
          </div>
        </div>

        {/* 지도 */}
        <div style={isMobile ? { position: 'absolute', inset: 0 } : { flex: 1, position: 'relative' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* 좌측 패널 열기/닫기 핸들 (모바일은 시트의 드래그 핸들이 대신한다) */}
          <button
            onClick={() => setPanelOpen(o => !o)}
            title={panelOpen ? '패널 닫기' : '경로 안내 열기'}
            style={{
              position: 'absolute', top: 16, left: 0, zIndex: 11,
              width: 30, height: 46, padding: 0, cursor: 'pointer',
              display: isMobile ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: 'none',
              borderRadius: '0 10px 10px 0', color: 'var(--text-muted)', boxShadow: '2px 0 8px rgba(15,23,42,.06)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: panelOpen ? 'rotate(180deg)' : 'none' }}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          {/* 상단 검색에서 고른 장소 → 출발/도착 선택 팝업 */}
          {pendingPlace && (
            <div style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
              padding: 16, minWidth: 260, boxShadow: 'var(--shadow)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Icon name="map-pin" size={16} color="var(--blue-primary)" style={{ marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.2px' }}>{pendingPlace.name}</div>
                  {pendingPlace.address && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{pendingPlace.address}</div>}
                </div>
                <button onClick={() => setPendingPlace(null)} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, display: 'flex', padding: 0 }}><Icon name="x" size={17} /></button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={applyPendingAsStart} style={{ flex: 1, height: 40, border: 'none', borderRadius: 10, background: START_COLOR, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>출발지로 설정</button>
                <button onClick={applyPendingAsDest} style={{ flex: 1, height: 40, border: 'none', borderRadius: 10, background: DEST_COLOR, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>도착지로 설정</button>
              </div>
            </div>
          )}

          {selectedRoute && (
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: isMobile ? 12 : 16, minWidth: isMobile ? 0 : 170, maxWidth: isMobile ? '58%' : 'none', boxShadow: 'var(--shadow)', display: isMobile && panelOpen ? 'none' : 'block' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>선택 경로 안전도</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: scoreColor(selectedRoute.safetyScore) }}>CCTV {selectedRoute.safetyScore}개</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{selectedRoute.description}</div>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: isMobile ? visibleOffset() + 16 : 20, right: isMobile ? 12 : 20, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            {['+', '−'].map((btn, i) => (
              <button key={btn} onClick={() => { if (!mapInstance.current) return; const level = mapInstance.current.getLevel(); mapInstance.current.setLevel(btn === '+' ? level - 1 : level + 1) }}
                style={{ width: 40, height: 40, border: 'none', borderBottom: i === 0 ? '1px solid var(--border)' : 'none', background: 'transparent', cursor: 'pointer', fontSize: 19, color: 'var(--text-strong)' }}>{btn}</button>
            ))}
          </div>
          <button onClick={() => { if (currentLocation) centerOnVisible(new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng)) }}
            style={{ position: 'absolute', bottom: isMobile ? visibleOffset() + 104 : 108, right: isMobile ? 12 : 20, zIndex: 10, width: 40, height: 40, borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--blue-primary)', cursor: 'pointer', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
    </UserShell>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}
function ModeBtn({ active, onClick, children }) {
  return <button onClick={onClick} style={{ flex: 1, height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', border: `1px solid ${active ? 'transparent' : 'var(--border)'}`, background: active ? 'var(--blue-primary)' : 'var(--bg)', color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500 }}>{children}</button>
}
function TabBtn({ active, onClick, children }) {
  return <button onClick={onClick} style={{ flex: 1, padding: '9px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: active ? 'var(--blue-primary)' : 'var(--text-muted)', borderBottom: `2px solid ${active ? 'var(--blue-primary)' : 'transparent'}`, marginBottom: -1, fontWeight: active ? 700 : 500 }}>{children}</button>
}
function ResultList({ list, onPick, color }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}>
      {list.map((place, idx) => (
        <div key={idx} onClick={() => onPick(place)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
          <Icon name="map-pin" size={15} color={color} style={{ marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{place.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{place.address}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const inputStyle = { width: '100%', height: 42, padding: '0 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-strong)', outline: 'none', fontFamily: 'inherit', marginBottom: 4 }
