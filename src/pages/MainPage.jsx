import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import MapView from '../components/Map/MapView'
import RightPanel from '../components/RightPanel/RightPanel'
import SosButton from '../components/SosButton/SosButton'
import { useSafetyData } from '../hooks/useSafetyData'

export default function MainPage({ user, onLogout }) {
  const location = useLocation()
  const { dangerZones, isLoading } = useSafetyData()
  const [filters, setFilters] = useState({ cctv: true, streetLamp: true, safeZone: false })

  // 상단 검색(모든 페이지 공용) 또는 다른 페이지에서 넘어온 장소로 지도 이동
  const [mapTarget, setMapTarget] = useState(null)
  useEffect(() => {
    const p = location.state?.searchPlace
    if (p) setMapTarget({ lat: p.lat, lng: p.lng, name: p.name })
  }, [location.state])

  // 경로 안내에서 넘어온 데이터
  const routeState = location.state?.routeActive ? location.state : null

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
        searchTarget={mapTarget}
      />
      <SosButton user={user} />
    </UserShell>
  )
}
