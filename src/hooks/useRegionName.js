// 현재 위치 → 행정동 이름 (예: "마포구 서교동")
// 카카오 지도 SDK의 services 라이브러리(coord2RegionCode)를 쓰므로 백엔드가 필요 없다.
// 위치 권한이 없거나 SDK가 아직 안 떴으면 null을 돌려주고, 호출부는 지역 표기를 생략한다.
import { useState, useEffect } from 'react'

export default function useRegionName() {
  const [region, setRegion] = useState(null)

  useEffect(() => {
    let cancelled = false

    const lookup = (lat, lng) => {
      const geocoder = new window.kakao.maps.services.Geocoder()
      geocoder.coord2RegionCode(lng, lat, (result, status) => {
        if (cancelled) return
        if (status !== window.kakao.maps.services.Status.OK || !result?.length) return
        // region_type 'H' = 행정동. 없으면 첫 결과(법정동)로 대체한다.
        const r = result.find(x => x.region_type === 'H') || result[0]
        const name = [r.region_2depth_name, r.region_3depth_name].filter(Boolean).join(' ')
        if (name) setRegion(name)
      })
    }

    const start = () => {
      if (!window.kakao?.maps?.services || !navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        pos => lookup(pos.coords.latitude, pos.coords.longitude),
        () => {}, // 권한 거부 시 지역 표기 없이 진행
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      )
    }

    // SDK가 아직 로드 중일 수 있어 kakao.maps.load로 감싼다.
    if (window.kakao?.maps?.services) start()
    else if (window.kakao?.maps?.load) window.kakao.maps.load(start)

    return () => { cancelled = true }
  }, [])

  return region
}
