// 좌표 → 주소 (카카오 지도 SDK services 라이브러리의 coord2Address)
//
// 백엔드는 긴급신고를 위경도로만 내려준다. 숫자 두 개는 사람이 읽을 수 있는 위치가 아니라서
// "37.50123, 127.00456" 대신 "서울 마포구 양화로 45" 를 앞세우고 좌표는 옆에 작게 남긴다.
// 좌표를 지우지는 않는다 — 관리자가 지도 앱에 찍어 넣거나 신고끼리 대조할 때 필요하다.
//
// 서버를 거치지 않는다. SDK 는 index.html 에서 libraries=services 로 이미 불러온다.

// 같은 좌표를 두 번 묻지 않는다. 관리자 표는 한 화면에 20행이고 페이지를 오가며 같은 신고를
// 다시 그리는데, 캐시가 없으면 그릴 때마다 카카오에 다시 물어보게 된다.
// 값이 null 인 항목도 캐시한다 — '주소 없음'(바다·산속 등)도 확정된 답이다.
const cache = new Map()
// 같은 좌표를 동시에 여러 행이 물어보면 요청 하나로 합친다.
const inflight = new Map()

export const coordKey = (lat, lng) => `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`
const keyOf = coordKey

// SDK 로드가 끝나면 실행한다. 스크립트는 head 에서 동기로 불러오지만
// 라우팅에 따라 아직 준비 전일 수 있어 kakao.maps.load 로 한 번 감싼다.
function whenReady(run) {
  if (window.kakao?.maps?.services) { run(); return }
  if (window.kakao?.maps?.load) { window.kakao.maps.load(run); return }
  // SDK 자체가 아직 안 붙었으면 잠깐 기다린다(MapView 도 같은 방식이다).
  let tries = 0
  const timer = setInterval(() => {
    if (window.kakao?.maps?.services) { clearInterval(timer); run() }
    else if (window.kakao?.maps?.load) { clearInterval(timer); window.kakao.maps.load(run) }
    else if (++tries > 40) clearInterval(timer)   // 12초쯤 기다리고 포기한다
  }, 300)
}

// 도로명이 있으면 도로명, 없으면 지번. 카카오는 도로명이 없는 곳(공터·산간)도 흔하다.
function pickAddress(result) {
  const r = result?.[0]
  if (!r) return null
  return r.road_address?.address_name || r.address?.address_name || null
}

/**
 * 좌표 하나를 주소로 바꾼다. 실패하면 null.
 * @returns {Promise<string|null>}
 */
export function lookupAddress(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return Promise.resolve(null)
  }

  const key = keyOf(lat, lng)
  if (cache.has(key)) return Promise.resolve(cache.get(key))
  if (inflight.has(key)) return inflight.get(key)

  const p = new Promise(resolve => {
    whenReady(() => {
      const geocoder = new window.kakao.maps.services.Geocoder()
      // 카카오는 (경도, 위도) 순서다. 뒤집어 넣으면 엉뚱한 나라가 나온다.
      geocoder.coord2Address(Number(lng), Number(lat), (result, status) => {
        const ok = status === window.kakao.maps.services.Status.OK
        const address = ok ? pickAddress(result) : null
        cache.set(key, address)
        inflight.delete(key)
        resolve(address)
      })
    })
  })

  inflight.set(key, p)
  return p
}

// 이미 물어본 좌표면 즉시 값을 준다(첫 렌더에 '불러오는 중'을 안 거치게 한다).
export function cachedAddress(lat, lng) {
  if (lat == null || lng == null) return undefined
  return cache.get(keyOf(lat, lng))
}

// 좌표 표기는 소수점 5자리(약 1m)면 충분하다. 그 아래는 GPS 오차 범위라 의미가 없다.
export const fmtCoord = (lat, lng) =>
  (lat == null || lng == null ? '-' : `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`)
