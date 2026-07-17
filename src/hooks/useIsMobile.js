// 뷰포트 폭으로 모바일 여부를 판단한다 (서버가 아니라 브라우저가 판단).
// 768px 이하 = 모바일 셸, 초과 = 데스크탑 셸.
// change 와 resize 를 모두 구독한다: 일부 환경(기기 에뮬레이터 등)은 둘 중 하나만 발생시킨다.
import { useState, useEffect } from 'react'

const MOBILE_QUERY = '(max-width: 768px)'

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return isMobile
}
