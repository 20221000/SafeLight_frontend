import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import MapView from '../components/Map/MapView'
import RightPanel from '../components/RightPanel/RightPanel'
import SosButton from '../components/SosButton/SosButton'
import { useSafetyData } from '../hooks/useSafetyData'
import ConfirmDialog from '../components/layout/ConfirmDialog'
import { loadActiveRoute, clearActiveRoute } from '../utils/activeRoute'

export default function MainPage({ user, onLogout }) {
  const location = useLocation()
  const { dangerZones, isLoading } = useSafetyData()
  // safeZone = 편의점(안전거점). streetLamp 은 아직 데이터가 없어 칩이 잠겨 있으므로 꺼둔다.
  const [filters, setFilters] = useState({ cctv: true, streetLamp: false, safeZone: true })

  // 상단 검색(모든 페이지 공용) 또는 다른 페이지에서 넘어온 장소로 지도 이동
  const [mapTarget, setMapTarget] = useState(null)
  useEffect(() => {
    const p = location.state?.searchPlace
    if (p) setMapTarget({ lat: p.lat, lng: p.lng, name: p.name })
  }, [location.state])

  // 안내 중인 경로 — 세션에서 복원한다. navigate state 로만 받으면 다른 화면에 갔다 오는 순간
  // 사라지므로, 사용자가 직접 취소할 때까지 유지되도록 세션에 보관한 값을 읽는다.
  const [routeState, setRouteState] = useState(loadActiveRoute)
  const [askCancelRoute, setAskCancelRoute] = useState(false)

  const confirmCancelRoute = () => {
    clearActiveRoute()
    setRouteState(null)
    setAskCancelRoute(false)
  }

  return (
    <UserShell
      user={user}
      onLogout={onLogout}
      active="map"
      scroll={false}
      contentBg="var(--map-bg)"
      rightDrawer={<RightPanel dangerZones={dangerZones} isLoading={isLoading} />}
    >
      <MapView
        filters={filters}
        onToggleFilter={key => setFilters(prev => ({ ...prev, [key]: !prev[key] }))}
        dangerZones={dangerZones}
        routeState={routeState}
        onCancelRoute={() => setAskCancelRoute(true)}
        searchTarget={mapTarget}
      />
      <SosButton user={user} />

      <ConfirmDialog
        open={askCancelRoute}
        title="경로 안내를 취소하겠습니까?"
        message="지도에 표시된 안전 경로가 사라집니다."
        confirmLabel="안내 취소"
        cancelLabel="계속 안내"
        onConfirm={confirmCancelRoute}
        onCancel={() => setAskCancelRoute(false)}
      />
    </UserShell>
  )
}
