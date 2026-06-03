import { useState, useEffect, useCallback } from 'react'

const fetchDangerZones = async () => {
  try {
    const token = localStorage.getItem('accessToken')
    if (!token) return []

    const res = await fetch('/danger-zones', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json()
    return json.success ? json.data : []
  } catch (err) {
    console.error('위험구역 조회 실패:', err)
    return []
  }
}

const fetchSafetyStats = async () => {
  try {
    const token = localStorage.getItem('accessToken')
    if (!token) return { cctv: 0, streetLamp: 0, convenience: 0, safetyScore: 0 }

    // 추후 백엔드 stats API 구현되면 연동
    return { cctv: 0, streetLamp: 0, convenience: 0, safetyScore: 0 }
  } catch (err) {
    return { cctv: 0, streetLamp: 0, convenience: 0, safetyScore: 0 }
  }
}

export function useSafetyData() {
  const [safetyStats, setSafetyStats] = useState({
    cctv: 0, streetLamp: 0, convenience: 0, safetyScore: 0,
  })
  const [dangerZones, setDangerZones] = useState([])
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [stats, zones] = await Promise.all([
        fetchSafetyStats(),
        fetchDangerZones(),
      ])
      setSafetyStats(stats)
      setDangerZones(zones)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('안전 데이터 업데이트 실패:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const timer = setInterval(refresh, 30000)
    return () => clearInterval(timer)
  }, [refresh])

  return { safetyStats, dangerZones, lastUpdated, isLoading, refresh }
}