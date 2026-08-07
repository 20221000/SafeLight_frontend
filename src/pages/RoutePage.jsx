import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import useIsMobile from '../hooks/useIsMobile'
import Icon from '../components/Icon'
import useDragSheet from '../hooks/useDragSheet'
import useSheetHeadHeight from '../hooks/useSheetHeadHeight'
import { SHEET_COLLAPSED } from '../components/layout/BottomSheet'
import { readEnvelope } from '../utils/apiResponse'
import { saveActiveRoute } from '../utils/activeRoute'
import { LAYER_COLOR, FACILITY_MAX_LEVEL, dotContent } from '../components/Map/layerStyle'

const START_COLOR = '#2563EB'
const DEST_COLOR = '#E11D48'

// 구간 식별자 — 이름이 아니라 좌표로 만든다(같은 자리라도 이름은 나중에 주소로 바뀐다).
const coordKey = (p) => (p ? `${p.lat},${p.lng}` : '')
const segmentKey = (start, dest) => `${coordKey(start)}|${coordKey(dest)}`
// 배경 CCTV 점은 경로 위 안전시설 점(9px)보다 크면 시선을 뺏는다 — 한 단계 작게 둔다.
const cctvDot = dotContent(LAYER_COLOR.cctv, 9)

// '2026-08-06T08:35:12' → '08-06 08:35'
const fmtSearchedAt = (iso) => (iso ? String(iso).slice(5, 16).replace('T', ' ') : '')

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
  const facilityOverlaysRef = useRef([])
  const cctvDataRef = useRef([])
  const cctvOverlaysRef = useRef([])
  const resultSegmentRef = useRef('') // 지금 띄워둔 검색 결과가 어느 구간의 것인지

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

  // 북마크는 도착지 탭에서 빠져나와 아래 전용 카드로 옮겼다 — 도착지 지정이 아니라 '바로 안내' 지름길이라
  // 같은 탭 줄에 두면 성격이 섞인다.
  const [destMode, setDestMode] = useState('search')
  const [destSearch, setDestSearch] = useState('')
  const [destResult, setDestResult] = useState([])
  const [selectedDest, setSelectedDest] = useState(null)

  const [bookmarkQuery, setBookmarkQuery] = useState('')
  const [bookmarkSort, setBookmarkSort] = useState('recent')
  const [bookmarkBusyId, setBookmarkBusyId] = useState(null) // 경로를 다시 받는 중인 북마크

  const [mapReady, setMapReady] = useState(false) // 카카오 지도 인스턴스 생성 완료 (마커 동기화 시점)
  const [pendingPlace, setPendingPlace] = useState(null) // 상단 검색에서 넘어온 장소 (출발/도착 선택 대기)
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [isSearched, setIsSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bookmarks, setBookmarks] = useState([])
  const [recentRoutes, setRecentRoutes] = useState([])
  const [recentLabels, setRecentLabels] = useState({}) // routeHistoryId → 도착지 주소 (역지오코딩 결과)
  const [panelOpen, setPanelOpen] = useState(true) // 좌측 경로 안내 패널 열기/닫기

  const token = localStorage.getItem('accessToken')
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  // 지도 화면(MapView)과 같은 규칙으로 CCTV 를 그린다 — 화면 안에 있는 것만, 이 레벨까지만.
  // 예전에는 전국 CCTV 를 통째로 마커 클러스터러에 넣어서, 넓게 보면 숫자 뭉치만 잔뜩 뜨고 느렸다.
  const renderCctvInBounds = useCallback(() => {
    const map = mapInstance.current
    if (!map || !window.kakao) return
    cctvOverlaysRef.current.forEach(o => o.setMap(null))
    cctvOverlaysRef.current = []
    if (map.getLevel() > FACILITY_MAX_LEVEL) return

    const bounds = map.getBounds()
    cctvDataRef.current.forEach(pos => {
      const latlng = new window.kakao.maps.LatLng(pos.lat, pos.lng)
      if (!bounds.contain(latlng)) return
      const overlay = new window.kakao.maps.CustomOverlay({
        position: latlng, content: cctvDot, yAnchor: 0.5, xAnchor: 0.5, zIndex: 1,
      })
      overlay.setMap(map)
      cctvOverlaysRef.current.push(overlay)
    })
  }, [])

  useEffect(() => {
    const initMap = () => {
      if (!window.kakao || !window.kakao.maps) return
      const container = mapRef.current
      mapInstance.current = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(37.4979, 127.0276), level: FACILITY_MAX_LEVEL,
      })
      window.kakao.maps.event.addListener(mapInstance.current, 'idle', renderCctvInBounds)
      setMapReady(true)
      fetch('/cctvs').then(readEnvelope).then(json => {
        if (!json.success || !json.data) return
        cctvDataRef.current = json.data.map(item => ({ lat: item.latitude, lng: item.longitude }))
        renderCctvInBounds()
      }).catch(err => console.error('CCTV 로드 실패:', err))
    }
    if (window.kakao && window.kakao.maps) initMap()
    else {
      const check = setInterval(() => { if (window.kakao && window.kakao.maps) { clearInterval(check); initMap() } }, 300)
      return () => clearInterval(check)
    }
  }, [renderCctvInBounds])

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
            mapInstance.current.setLevel(FACILITY_MAX_LEVEL)
            centerOnVisible(new window.kakao.maps.LatLng(latitude, longitude))
          }
        },
        () => setCurrentLocation(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }
  }, [startMode, centerOnVisible, reverseGeocode])

  // 좌측 패널 접힘/펼침 등으로 지도 컨테이너 크기가 바뀌면 카카오 지도 relayout (안 하면 타일이 잘림).
  // 넓어진 만큼 화면에 새로 들어온 CCTV 도 같이 그린다 — relayout 만으로는 점이 이전 영역 기준으로 남는다.
  useEffect(() => {
    if (!mapRef.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!mapInstance.current) return
      requestAnimationFrame(() => {
        mapInstance.current.relayout()
        renderCctvInBounds()
      })
    })
    ro.observe(mapRef.current)
    return () => ro.disconnect()
  }, [renderCctvInBounds])

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

  // 최근 경로 — /routes 가 성공하면 백엔드가 알아서 저장한다. 프론트는 조회·삭제만 맡는다.
  const fetchRecentRoutes = useCallback(async () => {
    if (!token) { setRecentRoutes([]); return }
    try {
      const res = await fetch('/recent-routes', { headers: { Authorization: `Bearer ${token}` } })
      const json = await readEnvelope(res)
      if (json.success) setRecentRoutes(json.data ?? [])
      else console.warn('최근 경로 조회 실패:', json.message)
    } catch (err) { console.error('최근 경로 조회 실패:', err) }
  }, [token])

  useEffect(() => { fetchRecentRoutes() }, [fetchRecentRoutes])

  // 백엔드는 자동 저장 시 이름을 '최근 검색 경로'로 고정해 저장한다. 목록에서 구분이 안 되므로
  // 도착지 좌표를 주소로 바꿔서 보여준다.
  useEffect(() => {
    if (!mapReady || recentRoutes.length === 0) return
    let alive = true
    Promise.all(recentRoutes.map(async (rh) => [
      rh.routeHistoryId,
      await reverseGeocode(rh.endLatitude, rh.endLongitude),
    ])).then(pairs => {
      if (alive) setRecentLabels(Object.fromEntries(pairs.filter(([, addr]) => addr)))
    })
    return () => { alive = false }
  }, [mapReady, recentRoutes, reverseGeocode])

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

  // 경로 주변 안전시설 점 — 백엔드가 경로마다 cctvLocations / storeLocations 를 같이 내려준다.
  const clearFacilities = useCallback(() => { facilityOverlaysRef.current.forEach(o => o.setMap(null)); facilityOverlaysRef.current = [] }, [])

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach(p => p.setMap(null)); polylinesRef.current = []
    clearFacilities()
  }, [clearFacilities])

  const drawFacilities = (route) => {
    clearFacilities()
    if (!mapInstance.current || !window.kakao) return
    const dot = (color) =>
      `<div style="width:9px;height:9px;border-radius:50%;background:${color};border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,.18)"></div>`
    const add = (list, color) => {
      ;(Array.isArray(list) ? list : []).forEach(p => {
        if (p?.latitude == null || p?.longitude == null) return
        const o = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(p.latitude, p.longitude),
          content: dot(color), yAnchor: 0.5, xAnchor: 0.5, zIndex: 2,
        })
        o.setMap(mapInstance.current)
        facilityOverlaysRef.current.push(o)
      })
    }
    add(route?.cctvLocations, LAYER_COLOR.cctv)
    add(route?.storeLocations, LAYER_COLOR.store)
  }

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

  // 출발·도착이 바뀌면 이전 검색 결과는 더 이상 이 구간의 것이 아니다 — 통째로 버린다.
  // 안 버리면 마커만 새 위치로 옮겨가고 경로선·추천 목록·안전도 패널은 옛 구간 그대로 남았다.
  // (그 상태에서 '지도에서 경로 보기'를 누르면 옛 경로선에 새 출발·도착을 붙여 안내를 시작한다.)
  // 검색 버튼도 다시 나타나므로 새 구간을 바로 조회할 수 있다.
  //
  // 객체가 아니라 좌표를 기준으로 본다. 현재 위치는 역지오코딩이 끝나면 이름만 채워
  // 새 객체로 교체되는데, 그때까지 결과를 지워버리면 안 된다.
  //
  // resultSegmentRef 는 '지금 띄워둔 결과가 어느 구간의 것인지'다. 북마크는 구간과 결과를
  // 한 번에 바꾸므로, 이게 없으면 이 effect 가 방금 띄운 결과를 곧바로 지워버린다.
  const segment = segmentKey(selectedStart, selectedDest)
  useEffect(() => {
    if (segment === resultSegmentRef.current) return
    resultSegmentRef.current = ''
    setIsSearched(false)
    setRoutes([])
    setSelectedRoute(null)
    clearPolylines()
  }, [segment, clearPolylines])

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

  // 받은 경로들을 화면(③ 추천 경로 + 지도)에 올린다. 검색과 북마크가 같은 결과 화면을 쓴다.
  // 어느 구간의 결과인지 함께 기록해 둔다 — 위의 무효화 effect 가 이걸 보고 그냥 지나간다.
  const showRoutes = (found, start, dest) => {
    resultSegmentRef.current = segmentKey(start, dest)
    setRoutes(found); setSelectedRoute(found[0]); setIsSearched(true)
    drawRoute(found[0])
  }

  // /routes 호출 한 곳. 경로 검색과 북마크가 같은 응답 형태를 쓰므로 공유한다.
  // 백엔드는 안전 점수 상위 경로들을 한 번에(최대 3개) 돌려준다 — 개수는 백엔드가 정한다.
  const requestRoutes = async (start, dest) => {
    const res = await fetch('/routes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ startLatitude: start.lat, startLongitude: start.lng, endLatitude: dest.lat, endLongitude: dest.lng }),
    })
    const json = await readEnvelope(res)
    const found = json.success ? (json.data ?? []) : []
    // 실패 사유를 그대로 넘긴다 ('경로 없음'과 '권한 없음'은 다르다).
    if (found.length === 0) return { routes: [], message: json.message }
    return {
      routes: [...found]
        .sort((a, b) => b.safetyScore - a.safetyScore)
        .map((r, idx) => ({ ...r, routeId: idx + 1, label: idx === 0 ? '추천' : `경로 ${idx + 1}` })),
      message: null,
    }
  }

  const handleSearchRoute = async () => {
    if (!selectedStart || !selectedDest) { alert('출발지와 도착지를 설정해주세요.'); return }
    setLoading(true)
    try {
      const { routes: labeled, message } = await requestRoutes(selectedStart, selectedDest)
      if (labeled.length === 0) { alert(message || '경로를 찾을 수 없습니다.'); return }
      showRoutes(labeled, selectedStart, selectedDest)
      fetchRecentRoutes() // 백엔드가 이번 검색을 최근 경로에 저장했으므로 목록을 새로 받는다.
    } catch (err) {
      console.error('경로 검색 실패:', err); alert('경로 검색에 실패했습니다.')
    } finally { setLoading(false) }
  }

  // 선택한 경로로 안내를 시작한다 — 세션에 저장해야 다른 화면에 갔다 와도 유지된다(취소는 지도 배너에서).
  const startGuidance = (route, start, dest) => {
    saveActiveRoute({ routePath: route.path, start, dest, safetyScore: route.safetyScore })
    navigate('/')
  }

  const drawRoute = (route) => {
    if (!mapInstance.current || !route?.path) return
    clearPolylines() // 마커는 건드리지 않는다 — 동기화 effect가 이미 출발/도착 하나씩 유지 중이다.
    const linePath = route.path.map(point => new window.kakao.maps.LatLng(point.latitude, point.longitude))
    if (linePath.length === 0) return
    const polyline = new window.kakao.maps.Polyline({ path: linePath, strokeWeight: 6, strokeColor: START_COLOR, strokeOpacity: 0.9, strokeStyle: 'solid' })
    polyline.setMap(mapInstance.current); polylinesRef.current.push(polyline)
    drawFacilities(route)
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

  const handleRecentDelete = async (routeHistoryId) => {
    try {
      await fetch(`/recent-routes/${routeHistoryId}`, { method: 'DELETE', headers: authHeader })
      fetchRecentRoutes()
    } catch { alert('삭제에 실패했습니다.') }
  }

  const handleRecentClear = async () => {
    if (!window.confirm('최근 경로를 모두 지울까요?')) return
    try {
      await fetch('/recent-routes/all', { method: 'DELETE', headers: authHeader })
      fetchRecentRoutes()
    } catch { alert('삭제에 실패했습니다.') }
  }

  const handleRecentRoute = (rh) => {
    const start = { lat: rh.startLatitude, lng: rh.startLongitude, name: '출발지' }
    const dest = { lat: rh.endLatitude, lng: rh.endLongitude, name: recentLabels[rh.routeHistoryId] || '도착지' }
    setSelectedStart(start); setSelectedDest(dest)
    setStartSearch(start.name); setDestSearch(dest.name); setStartMode('search')
    // 출발지 주소는 목록에 없으니 이때 한 번 더 조회해 이름을 채운다.
    reverseGeocode(rh.startLatitude, rh.startLongitude).then(addr => {
      if (!addr) return
      setSelectedStart(prev => (prev && prev.lat === start.lat && prev.lng === start.lng ? { ...prev, name: addr } : prev))
      setStartSearch(addr)
    })
  }

  // 북마크를 누르면 이 화면에 경로를 바로 띄운다 — 안내 시작은 사용자가 '지도에서 경로 보기'로
  // 직접 누른다. (예전엔 누르자마자 지도 탭으로 넘겼는데, 어떤 길로 가는지 확인할 틈이 없었다.)
  // 북마크에는 출발·도착 좌표만 저장돼 있고 경로 선(path)은 없어서 경로는 다시 받아야 한다.
  const handleBookmarkRoute = async (bookmark) => {
    if (bookmarkBusyId != null) return
    const [startName, destName] = String(bookmark.routeName ?? '').split(' → ')
    const start = { lat: bookmark.startLatitude, lng: bookmark.startLongitude, name: startName || '출발지' }
    const dest = { lat: bookmark.endLatitude, lng: bookmark.endLongitude, name: destName || '도착지' }
    setBookmarkBusyId(bookmark.id)
    // 출발·도착을 먼저 채운다. 경로를 못 받더라도 사용자가 처음부터 다시 넣지 않아도 되고,
    // 받아 오는 동안 어디→어디를 준비 중인지 보인다.
    setSelectedStart(start); setSelectedDest(dest)
    setStartSearch(start.name); setDestSearch(dest.name)
    setStartMode('search'); setDestMode('search')
    try {
      const { routes: found, message } = await requestRoutes(start, dest)
      if (found.length === 0) { alert(message || '경로를 찾을 수 없습니다.'); return }
      fetchRecentRoutes()
      showRoutes(found, start, dest)
    } catch (err) {
      console.error('북마크 경로 조회 실패:', err)
      alert('경로를 불러오지 못했습니다.')
    } finally { setBookmarkBusyId(null) }
  }

  // 검색어 + 정렬. 백엔드 Bookmark 에는 생성 시각 컬럼이 없어 '최신'은 id 순(= 저장한 순서)으로 판단한다.
  // 목록 API 도 이미 id DESC 로 내려주므로 기준이 같다.
  const visibleBookmarks = useMemo(() => {
    const q = bookmarkQuery.trim().toLowerCase()
    const list = q ? bookmarks.filter(b => String(b.routeName ?? '').toLowerCase().includes(q)) : [...bookmarks]
    return bookmarkSort === 'name'
      ? list.sort((a, b) => String(a.routeName ?? '').localeCompare(String(b.routeName ?? ''), 'ko'))
      : list.sort((a, b) => b.id - a.id)
  }, [bookmarks, bookmarkQuery, bookmarkSort])

  const scoreColor = (score) => (score >= 20 ? 'var(--safe)' : score >= 10 ? 'var(--warning)' : 'var(--danger)')

  // 백엔드 RouteService.analyzeSafetyData: safetyScore = 경로 50m 이내 CCTV 수 + 편의점 수.
  // 예전엔 이 값을 'CCTV n개'로만 적었는데 편의점이 섞여 있어 틀린 라벨이었다.
  const facilityCounts = (route) => ({
    cctv: route?.cctvLocations?.length ?? null,
    store: route?.storeLocations?.length ?? null,
  })
  const facilityDetail = (route) => {
    const { cctv, store } = facilityCounts(route)
    if (cctv == null && store == null) return null
    return `CCTV ${cctv ?? 0} · 편의점 ${store ?? 0}`
  }

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
                <TabBtn active={destMode === 'recent'} onClick={() => setDestMode('recent')}><Icon name="clock" size={14} /> 최근</TabBtn>
                <TabBtn active={destMode === 'search'} onClick={() => setDestMode('search')}><Icon name="search" size={14} /> 검색</TabBtn>
              </div>
              {destMode === 'recent' && (
                recentRoutes.length > 0 ? (
                  <>
                    {recentRoutes.map(rh => (
                      <div key={rh.routeHistoryId} onClick={() => handleRecentRoute(rh)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 10, cursor: 'pointer' }}>
                        <Icon name="clock" size={18} color="var(--text-muted)" />
                        {/* minWidth:0 — 긴 주소가 삭제(✕) 버튼을 밀어내지 않게. */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {recentLabels[rh.routeHistoryId] || rh.routeName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtSearchedAt(rh.searchedAt)}</div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleRecentDelete(rh.routeHistoryId) }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}><Icon name="x" size={16} /></button>
                      </div>
                    ))}
                    <button
                      onClick={handleRecentClear}
                      style={{
                        width: '100%', marginTop: 6, height: 34, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                        border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                      }}
                    >전체 삭제</button>
                  </>
                ) : <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>최근 검색한 경로가 없습니다.</div>
              )}
              {destMode === 'search' && (
                <div>
                  <input style={inputStyle} placeholder="도착지 검색..." value={destSearch} onChange={e => { setDestSearch(e.target.value); searchPlace(e.target.value, setDestResult) }} />
                  {destResult.length > 0 && <ResultList list={destResult} onPick={handleSelectDest} color={DEST_COLOR} />}
                </div>
              )}
            </Card>

            {/* 북마크 — 출발/도착을 하나씩 고르는 단계가 아니라 저장해 둔 구간을 한 번에 불러오는
                지름길이라 번호 없이 별도 카드로 둔다. 누르면 ①②가 채워지고 ③ 추천 경로까지 나온다. */}
            <Card
              title={<><Icon name="star" size={15} color="var(--blue-primary)" /> 북마크</>}
              right={bookmarks.length > 0
                ? <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {bookmarkQuery.trim() ? `${visibleBookmarks.length} / ${bookmarks.length}` : `${bookmarks.length}개`}
                  </span>
                : null}
            >
              {bookmarks.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 0', lineHeight: 1.6 }}>
                  저장된 북마크가 없습니다.
                  <div style={{ fontSize: 11.5, marginTop: 2 }}>경로를 찾은 뒤 ‘북마크 저장’을 눌러보세요.</div>
                </div>
              ) : (
                <>
                  <input
                    style={inputStyle}
                    placeholder="북마크 검색..."
                    value={bookmarkQuery}
                    onChange={e => setBookmarkQuery(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }}>
                    <SortChip active={bookmarkSort === 'recent'} onClick={() => setBookmarkSort('recent')}>
                      <Icon name="clock" size={12} /> 최신순
                    </SortChip>
                    <SortChip active={bookmarkSort === 'name'} onClick={() => setBookmarkSort('name')}>
                      가나다순
                    </SortChip>
                  </div>
                  {visibleBookmarks.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 0' }}>검색 결과가 없습니다.</div>
                  ) : visibleBookmarks.map(bm => {
                    const busy = bookmarkBusyId === bm.id
                    return (
                      <div
                        key={bm.id}
                        onClick={() => handleBookmarkRoute(bm)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 10,
                          cursor: bookmarkBusyId != null ? 'progress' : 'pointer',
                          background: busy ? 'var(--blue-tint)' : 'transparent',
                          opacity: bookmarkBusyId != null && !busy ? 0.5 : 1,
                        }}
                      >
                        <Icon name="star" size={18} color="var(--blue-primary)" />
                        {/* minWidth:0 — 긴 경로 이름이 삭제(✕) 버튼을 밀어내지 않게. */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.routeName}</div>
                          {/* 북마크 응답에는 safetyScore 합계만 있고 CCTV/편의점 내역은 없다. */}
                          <div style={{ fontSize: 11, color: busy ? 'var(--blue-primary)' : 'var(--text-muted)' }}>
                            {busy ? '경로를 불러오는 중…' : `안전시설 ${bm.safetyScore}곳 · 눌러서 경로 보기`}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleBookmarkDelete(bm.id) }}
                          disabled={bookmarkBusyId != null}
                          aria-label="북마크 삭제"
                          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0, flexShrink: 0 }}
                        ><Icon name="x" size={16} /></button>
                      </div>
                    )
                  })}
                </>
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
                        <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(route.safetyScore) }}>안전시설 {route.safetyScore}곳</span>
                      </div>
                      <div style={{ width: '100%', height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: 5, borderRadius: 3, background: scoreColor(route.safetyScore), width: `${Math.min(route.safetyScore * 2, 100)}%`, transition: 'width .4s' }} />
                      </div>
                      {/* 점수의 내역을 같이 보여준다 — 합계만 보면 무엇이 많아서 높은지 알 수 없다. */}
                      {facilityDetail(route) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: LAYER_COLOR.cctv }} />CCTV {facilityCounts(route).cctv ?? 0}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: LAYER_COLOR.store }} />편의점 {facilityCounts(route).store ?? 0}
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{route.description}</div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { if (selectedRoute) startGuidance(selectedRoute, selectedStart, selectedDest) }}
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
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2, color: scoreColor(selectedRoute.safetyScore) }}>안전시설 {selectedRoute.safetyScore}곳</div>
              {facilityDetail(selectedRoute) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{facilityDetail(selectedRoute)}</div>
              )}
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

function Card({ title, right, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  )
}
// 북마크 정렬용 작은 칩. ModeBtn 보다 낮고 좁아 카드 안 보조 컨트롤로 쓴다.
function SortChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px',
      borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
      border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
      background: active ? 'var(--blue-tint)' : 'var(--bg)',
      color: active ? 'var(--blue-primary)' : 'var(--text-muted)',
      fontWeight: active ? 700 : 500,
    }}>{children}</button>
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
