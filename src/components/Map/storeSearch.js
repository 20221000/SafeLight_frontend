// 편의점(안전거점) 조회 — 지도 화면(MapView)과 경로 화면(RoutePage)이 같이 쓴다.
//
// 백엔드에는 편의점 단독 엔드포인트가 없다. KakaoLocalService.getConvenienceStores 는
// POST /routes 안에서 '경로 50m 반경'으로만 쓰여 '지금 보이는 지도 영역' 질문에는 답할 수 없다.
// 그래서 백엔드가 쓰는 것과 같은 소스(카카오 로컬, category_group_code=CS2)를
// 지도 SDK 의 services 라이브러리로 직접 조회한다.
//
// MapView 안에 있던 것을 그대로 옮겼다. 경로 화면도 CCTV·가로등과 함께 편의점을 깔아야 하는데,
// 컴포넌트 안에 갇혀 있으면 같은 재귀 분할 로직을 한 벌 더 쓰게 된다.

const STORE_CATEGORY = 'CS2'
// 카카오 카테고리 검색은 한 번의 요청에서 15곳 × 3페이지 = 45곳까지만 준다(우리가 정한 한도가 아니다).
// 45곳이 꽉 찼다는 건 실제로는 더 있다는 뜻이므로, 그 영역만 4등분해 다시 검색한다.
// 꽉 차지 않은 영역은 더 쪼개지 않으므로 한산한 동네에서는 요청 수가 그대로다.
const STORE_PAGE_CAP = 45
const STORE_SPLIT_DEPTH = 2   // 4²= 최대 16조각. 여기까지 쪼개도 넘치면 그 사실을 문구로 알린다.

// 화면보다 이만큼 넓게 검색해 둔다. 조금 움직일 때마다(특히 내 위치 따라가기 중) 다시 검색하지 않기 위한 여유분.
// CCTV·가로등의 facilityApi PAD_RATIO 와 같은 값이다.
const STORE_PAD_RATIO = 0.5

// 화면 영역을 위아래·좌우로 여유분만큼 넓힌다.
export const padBounds = (bounds) => {
  const { LatLng, LatLngBounds } = window.kakao.maps
  const sw = bounds.getSouthWest(), ne = bounds.getNorthEast()
  const latPad = ((ne.getLat() - sw.getLat()) * STORE_PAD_RATIO) / 2
  const lngPad = ((ne.getLng() - sw.getLng()) * STORE_PAD_RATIO) / 2
  return new LatLngBounds(
    new LatLng(sw.getLat() - latPad, sw.getLng() - lngPad),
    new LatLng(ne.getLat() + latPad, ne.getLng() + lngPad),
  )
}

// outer 가 inner 를 통째로 품는지.
export const boundsContain = (outer, inner) => {
  const osw = outer.getSouthWest(), one = outer.getNorthEast()
  const isw = inner.getSouthWest(), ine = inner.getNorthEast()
  return osw.getLat() <= isw.getLat() && osw.getLng() <= isw.getLng() &&
    one.getLat() >= ine.getLat() && one.getLng() >= ine.getLng()
}

// 영역을 4분면으로 나눈다.
const splitBounds = (bounds) => {
  const { LatLng, LatLngBounds } = window.kakao.maps
  const sw = bounds.getSouthWest(), ne = bounds.getNorthEast()
  const midLat = (sw.getLat() + ne.getLat()) / 2
  const midLng = (sw.getLng() + ne.getLng()) / 2
  return [
    new LatLngBounds(sw, new LatLng(midLat, midLng)),
    new LatLngBounds(new LatLng(sw.getLat(), midLng), new LatLng(midLat, ne.getLng())),
    new LatLngBounds(new LatLng(midLat, sw.getLng()), new LatLng(ne.getLat(), midLng)),
    new LatLngBounds(new LatLng(midLat, midLng), ne),
  ]
}

// 한 영역을 끝까지(최대 3페이지) 훑는다.
const searchArea = (bounds) => new Promise(resolve => {
  const found = []
  const handle = (data, status, pagination) => {
    const { Status } = window.kakao.maps.services
    if (status === Status.ERROR) { resolve({ places: found, capped: false, failed: true }); return }
    if (status === Status.OK) {
      found.push(...data)
      if (pagination?.hasNextPage) { pagination.nextPage(); return }
    }
    resolve({ places: found, capped: found.length >= STORE_PAGE_CAP, failed: false })
  }
  new window.kakao.maps.services.Places().categorySearch(STORE_CATEGORY, handle, { bounds })
})

// 45곳에서 잘린 영역만 4등분해 재귀로 파고든다. 마지막에 id 로 중복을 걷어낸다 —
// 이웃한 조각은 경계를 공유하므로 경계 위의 편의점이 양쪽 결과에 다 들어온다.
export const collectStores = async (bounds, depth = 0) => {
  const area = await searchArea(bounds)
  if (area.failed) return { places: [], capped: false, failed: true }
  if (!area.capped || depth >= STORE_SPLIT_DEPTH) return { ...area, failed: false }

  const parts = await Promise.all(splitBounds(bounds).map(b => collectStores(b, depth + 1)))
  const byId = new Map()
  parts.forEach(p => p.places.forEach(place => byId.set(place.id, place)))
  return {
    places: [...byId.values()],
    capped: parts.some(p => p.capped),
    failed: parts.every(p => p.failed),
  }
}
