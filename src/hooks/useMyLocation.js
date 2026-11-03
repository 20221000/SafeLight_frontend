// 내 위치를 계속 받는다(watchPosition). 걸어가면 position 이 따라 바뀐다.
//
// 예전에는 지도를 열 때 getCurrentPosition 으로 한 번만 받아서, 야외에서 걸어도
// 내 위치 점이 처음 자리에 멈춰 있었다.
//
// 브라우저는 화면이 꺼지거나 다른 앱으로 넘어가면 위치를 주지 않는다 —
// 웹은 화면을 켜 둔 동안만 추적된다(꺼진 동안의 알림·추적은 안드로이드 앱 몫).
// 특히 iOS 는 다녀온 뒤에도 기존 watch 를 되살리지 않는 경우가 있어,
// 화면이 다시 보이면 watch 를 새로 건다.
import { useState, useEffect } from 'react'

const OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 5000, // 5초 안에 잡힌 위치는 다시 써도 된다 — 매번 새로 잡으면 배터리만 닳는다.
  timeout: 15000,
}

// enabled 가 false 면 위치를 받지 않는다(그리고 받던 것을 멈춘다).
// 반환: { position: { lat, lng, accuracy } | null, error: GeolocationPositionError | null }
//   error.code 1 = 권한 거부, 2 = 위치를 알 수 없음(GPS 꺼짐 등), 3 = 시간 초과
export default function useMyLocation(enabled = true) {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  // 화면이 다시 보일 때마다 1씩 올려 watch 를 새로 건다.
  const [restartKey, setRestartKey] = useState(0)

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRestartKey(k => k + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      // 시간 초과(3)는 다음 위치가 오면 풀린다. 권한 거부(1)는 사용자가 바꾸기 전까지 그대로다.
      (err) => setError(err),
      OPTIONS,
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, restartKey])

  return { position, error }
}
