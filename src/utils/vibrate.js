// 휴대폰 진동. 안드로이드 크롬 계열에서만 울리고, 데스크탑·아이폰 사파리는
// navigator.vibrate 가 없거나 무시하므로 아무 일도 일어나지 않는다(에러도 나지 않는다).
// 브라우저는 사용자가 페이지를 한 번이라도 누른 뒤에만 진동을 허락한다 —
// 로그인 버튼을 누르고 들어온 화면이면 이미 충족된다.
//
// 패턴은 [울림, 쉼, 울림, …] ms. 안드로이드 앱(alert/Haptics.kt)과 같은 값을 쓴다.
export const VIBRATION = {
  sosAccepted: [200, 100, 200],                  // 내 긴급신고가 접수됐다
  friendEmergency: [500, 200, 500, 200, 500],    // 친구가 긴급신고를 했다 — 가장 길고 세게
  message: [150],                                // 친구가 쪽지를 보냈다
}

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 일부 브라우저는 허용되지 않은 상황에서 던진다. 진동은 보조 수단이라 조용히 넘긴다.
  }
}
