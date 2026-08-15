// 야간 모드 저장소 — 셸(UserShell)과 셸 밖 화면(AuthLayout)이 같은 값을 본다.
//
// 로그인·회원가입은 라우트 구조상 UserShell 바깥에 있어서 셸이 붙여주는 .ls-dark 를
// 물려받지 못한다. 그래서 각자 여기서 읽어 자기 루트에 직접 붙인다.
// 키를 한곳에 모아두지 않으면 한쪽만 바꿨을 때 조용히 어긋난다.

const KEY = 'ls-night'

export const readNightMode = () => localStorage.getItem(KEY) === '1'

export const writeNightMode = (on) => localStorage.setItem(KEY, on ? '1' : '0')
