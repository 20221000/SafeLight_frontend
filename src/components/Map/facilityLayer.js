// '지금 보이는 범위의 시설을 점으로 그리기' — 지도 화면(MapView)과 경로 화면(RoutePage)이 같이 쓴다.
//
// 두 화면이 CCTV·가로등을 각각 그리면서 같은 절차를 네 번 적어 두고 있었다(합쳐 140줄):
//
//   지우기 → 꺼져 있으면 그만 → 너무 넓게 보면 그만 → 순번 매기고 조회 →
//   → 기다리는 사이 지도가 또 움직였으면 버리기 → 다시 지우고 → 화면 안의 것만 → 오버레이 생성
//
// 중간의 '순번' 처리가 특히 손으로 반복하면 안 되는 부분이다. 조회가 비동기라
// 늦게 끝난 옛 요청이 새 화면을 덮어쓰면 지도를 옮겼는데 이전 동네 점이 남는다.
//
// 편의점은 여기 넣지 않았다 — 출처(카카오 로컬)도, 응답 모양도, 재귀 분할도 다르다.
// 억지로 한 함수에 넣으면 분기만 늘고 읽기 어려워진다(storeSearch.js 참고).

import { kakaoBoundsToBox, isTooWide } from '../../utils/facilityApi'

/**
 * @param map          카카오 지도 인스턴스
 * @param overlaysRef  이 레이어가 그려 둔 오버레이를 담는 ref(빈 배열로 만들어 넘기면 여기서 Map 으로 바꿔 쓴다)
 * @param seqRef       요청 순번 ref. 늦게 온 옛 응답을 버리는 데 쓴다.
 * @param load         범위를 받아 [{ lat, lng }] 를 주는 함수(facilityApi 의 로더)
 * @param maxLevel     이 지도 레벨까지만 그린다. 넘으면 지우고 만다.
 * @param dot          오버레이 content(HTML 문자열)
 * @param zIndex       쌓임 순서(layerStyle.js 의 표)
 * @param enabled      레이어 칩이 꺼져 있으면 false. 지우기만 한다.
 * @param setNotice    안내문구 setter. 없으면 문구를 쓰지 않는다(경로 화면).
 * @param notice       { zoomOut, fail, empty, count } — count 는 개수를 받아 문구를 만든다.
 * @param label        콘솔 오류에 찍을 이름
 */
export async function renderFacilityDots({
  map, overlaysRef, seqRef,
  load, maxLevel, dot, zIndex,
  enabled = true,
  setNotice,
  notice = {},
  label,
}) {
  if (!map || !window.kakao) return

  const say = (text) => setNotice?.(text ?? '')

  // 그려 둔 점을 좌표 → 오버레이로 들고 있는다(처음엔 호출부가 준 빈 배열이라 Map 으로 바꾼다).
  if (!(overlaysRef.current instanceof Map)) overlaysRef.current = new Map()
  const drawn = overlaysRef.current

  const clear = () => {
    drawn.forEach(o => o.setMap(null))
    drawn.clear()
  }

  /*
   * 순번은 **맨 앞에서** 올린다. 그려야 할 때만 올리면, 조회가 나가 있는 사이 칩을 끄거나
   * 넓게 줌아웃했을 때 그 호출이 순번을 안 올려서 — 먼저 나간 조회가 돌아와 자기 순번이
   * 아직 최신인 줄 알고 점을 그린다(칩을 껐는데 점이 도로 생긴다).
   * 어떤 이유로든 다시 불리면 이전 요청은 무효가 되어야 한다.
   */
  const reqId = ++seqRef.current

  if (!enabled) { clear(); say(''); return }

  if (map.getLevel() > maxLevel) { clear(); say(notice.zoomOut); return }

  const box = kakaoBoundsToBox(map.getBounds())
  if (isTooWide(box)) { clear(); say(notice.zoomOut); return }

  let data
  try {
    data = await load(box)
  } catch (err) {
    // 못 받아온 것과 진짜 없는 것은 다르다. 실패했는데 '이 지역에는 없습니다' 라고 하면
    // 데이터가 없는 동네로 오해한다. 실패는 실패라고 적는다.
    console.error(`${label} 조회 실패:`, err)
    if (reqId === seqRef.current) { clear(); say(notice.fail) }
    return
  }

  // 기다리는 사이 지도가 또 움직였으면 이 결과는 버린다.
  if (reqId !== seqRef.current) return

  const bounds = map.getBounds()
  const visible = data.filter(pos =>
    bounds.contain(new window.kakao.maps.LatLng(pos.lat, pos.lng))
  )

  // 예전에는 매번 전부 지우고 다시 그렸다. 내 위치 따라가기 중엔 지도가 쉬지 않고 움직여서
  // 점들이 계속 깜빡였다. 화면에서 빠진 점만 지우고 새로 들어온 점만 더한다.
  const keep = new Set()
  visible.forEach(pos => {
    const key = `${pos.lat},${pos.lng}`
    keep.add(key)
    if (drawn.has(key)) return
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(pos.lat, pos.lng),
      content: dot, yAnchor: 0.5, xAnchor: 0.5, zIndex,
    })
    overlay.setMap(map)
    drawn.set(key, overlay)
  })
  drawn.forEach((overlay, key) => {
    if (keep.has(key)) return
    overlay.setMap(null)
    drawn.delete(key)
  })

  say(visible.length === 0 ? notice.empty : notice.count?.(visible.length))
}
