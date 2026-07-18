// 로그인 화면으로 이동할 때 직전 페이지를 backgroundLocation 으로 함께 넘긴다.
// App 이 이 값을 보고 데스크탑에서는 뒤 페이지를 블러 처리한 모달로 로그인을 띄운다.
import { useNavigate, useLocation } from 'react-router-dom'

export default function useAuthNav() {
  const navigate = useNavigate()
  const location = useLocation()
  return {
    goLogin: () => navigate('/login', { state: { backgroundLocation: location } }),
  }
}
