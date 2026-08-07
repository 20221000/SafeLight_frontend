// 상단바 벨 뱃지용 — 안 읽은 긴급 알림 수와 안 읽은 쪽지 수를 따로 센다.
//
// GET /notifications/unread-count → { unreadCount }   긴급신고(친구 SOS)
// GET /messages/unread-count      → { unreadCount }   쪽지
//
// 둘을 합치지 않고 나눠서 돌려주는 이유: 벨이 둘을 다르게 그린다.
// 긴급은 빨강(벨 자체가 빨개진다), 쪽지는 파랑 점만. 합계 하나로는 구분할 수 없다.
//
// 백엔드 notifications 테이블은 emergency_report_id 가 NOT NULL 이라 쪽지 알림을
// 담을 수 없다. 그래서 쪽지는 쪽지 API 로 따로 센다 — 임시방편이 아니라 두 엔드포인트 다
// 정식 API 이고 숫자도 서버가 센 값 그대로다. 한 테이블로 합치는 건 백엔드 요청 10번.
import { useState, useEffect, useCallback, useRef } from 'react'
import { readEnvelope } from '../utils/apiResponse'

// 알림·쪽지를 읽음 처리한 화면이 이 이벤트를 쏘면 셸의 뱃지가 다시 센다.
export const NOTIFICATIONS_CHANGED = 'ls-notifications-changed'
export const notifyNotificationsChanged = () =>
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))

// 화면을 보고 있는 동안에만 이 간격으로 다시 센다.
// 예전에는 폴링을 아예 안 했는데, 그러면 화면을 켜 둔 채로는 쪽지가 와도 영영 모른다
// (창을 옮겼다 돌아와야 focus 이벤트가 뜬다). 실시간 푸시가 들어오기 전까지의 절충이다.
const POLL_MS = 30000

export default function useUnreadNotifications(user) {
  const [counts, setCounts] = useState({ emergency: 0, message: 0 })

  // 폴링 타이머가 매번 새 refresh 를 붙잡지 않도록 ref 로 넘긴다.
  const refreshRef = useRef(null)

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!user || !token) { setCounts({ emergency: 0, message: 0 }); return }
    const headers = { Authorization: `Bearer ${token}` }

    const readCount = async (url) => {
      const res = await fetch(url, { headers })
      const json = await readEnvelope(res)
      return json.success ? Number(json.data?.unreadCount ?? 0) : null
    }

    // 한쪽이 실패해도 다른 쪽 숫자는 살린다 — 네트워크 오류로 뱃지를 지우지 않는다.
    const [emergency, message] = await Promise.all([
      readCount('/notifications/unread-count').catch(() => null),
      readCount('/messages/unread-count').catch(() => null),
    ])
    setCounts(prev => ({
      emergency: emergency ?? prev.emergency,
      message: message ?? prev.message,
    }))
  }, [user])

  refreshRef.current = refresh

  useEffect(() => { refresh() }, [refresh])

  // 다른 탭·화면에서 읽고 돌아온 경우, 그리고 알림 화면에서 읽음 처리한 직후를 반영한다.
  useEffect(() => {
    const onWake = () => refreshRef.current?.()
    window.addEventListener('focus', onWake)
    window.addEventListener(NOTIFICATIONS_CHANGED, onWake)
    // 탭을 다시 앞으로 가져왔을 때. focus 가 안 뜨는 브라우저·상황이 있다.
    const onVisible = () => { if (document.visibilityState === 'visible') onWake() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onWake)
      window.removeEventListener(NOTIFICATIONS_CHANGED, onWake)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // 숨은 탭에서는 돌리지 않는다. 켜 두기만 한 탭이 서버를 계속 두드릴 이유가 없다.
  useEffect(() => {
    if (!user) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshRef.current?.()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [user])

  return { ...counts, total: counts.emergency + counts.message, refresh }
}
