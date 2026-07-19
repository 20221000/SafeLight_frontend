// 안내 중인 경로를 세션에 보관한다.
//
// 예전에는 경로를 react-router 의 navigate state 로만 넘겨서, 지도 → 커뮤니티 → 지도 처럼
// 화면을 옮기면 state 가 사라지고 안내가 통째로 없어졌다. 사용자가 직접 취소하기 전까지는
// 유지돼야 하므로 sessionStorage 에 둔다(탭을 닫으면 자연히 정리된다).

const KEY = 'ls.activeRoute'

export function loadActiveRoute() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // 경로 좌표가 없으면 그릴 수 없으므로 없는 것으로 친다.
    return parsed?.routePath?.length ? parsed : null
  } catch {
    return null
  }
}

export function saveActiveRoute(route) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...route, routeActive: true }))
  } catch {
    // 저장에 실패해도 이번 화면의 안내 자체는 동작해야 하므로 조용히 넘어간다.
  }
}

export function clearActiveRoute() {
  try { sessionStorage.removeItem(KEY) } catch { /* 무시 */ }
}
