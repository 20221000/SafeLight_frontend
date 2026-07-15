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

export function useSafetyData() {
  const [dangerZones, setDangerZones] = useState([])
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const zones = await fetchDangerZones()
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

  return { dangerZones, lastUpdated, isLoading, refresh }
}