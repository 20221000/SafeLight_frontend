import { useState, useEffect, useCallback } from 'react'
import { readEnvelope } from '../utils/apiResponse'

const fetchDangerZones = async () => {
  try {
    const token = localStorage.getItem('accessToken')
    if (!token) return []

    const res = await fetch('/danger-zones', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await readEnvelope(res)
    if (!json.success) { console.warn('위험구역 조회 실패:', json.message); return [] }
    return json.data ?? []
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

  // 화면을 다시 볼 때 바로 맞춘다. 모바일 브라우저는 배경 탭의 타이머를 늦추거나 멈춰서
  // 폰을 잠갔다 켜면 30초 주기가 그동안 안 돈다 — 돌아왔을 때 낡은 위험구역을 보게 된다.
  useEffect(() => {
    const sync = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [refresh])

  return { dangerZones, lastUpdated, isLoading, refresh }
}