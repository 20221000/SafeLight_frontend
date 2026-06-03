import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar'
import SidebarToggleBtn from '../components/Sidebar/SidebarToggleBtn'
import MapView from '../components/Map/MapView'
import RightPanel from '../components/RightPanel/RightPanel'
import SosButton from '../components/SosButton/SosButton'
import { useSafetyData } from '../hooks/useSafetyData'
import { useNavigation } from '../hooks/useNavigation'
import { useSidebar } from '../hooks/useSidebar'

export default function MainPage({ user, onLogout }) {
  const navigate = useNavigate()
  const handleNavigate = useNavigation()
  const { sidebarOpen, setSidebarOpen } = useSidebar()
  const { safetyStats, dangerZones, lastUpdated, isLoading } = useSafetyData()
  const [filters, setFilters] = useState({ cctv: true, streetLamp: true, safeZone: true })

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      overflow: 'hidden', backgroundColor: '#0D1117', position: 'relative',
    }}>
      <Sidebar
        filters={filters}
        onFilterChange={key => setFilters(prev => ({ ...prev, [key]: !prev[key] }))}
        user={user}
        onLogout={onLogout}
        onGoLogin={() => navigate('/login')}
        onNavigate={handleNavigate}
        activePage="map"
        isOpen={sidebarOpen}
      />
      <SidebarToggleBtn isOpen={sidebarOpen} onClick={() => setSidebarOpen(prev => !prev)} />
      <main style={{ flex: 1, height: '100vh', position: 'relative', overflow: 'hidden' }}>
        <MapView filters={filters} dangerZones={dangerZones} />
        <SosButton user={user} />
      </main>
      <RightPanel
        safetyStats={safetyStats}
        dangerZones={dangerZones}
        lastUpdated={lastUpdated}
        isLoading={isLoading}
      />
    </div>
  )
}