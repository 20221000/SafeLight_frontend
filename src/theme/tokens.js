// Light Safe 공용 디자인 토큰 헬퍼 (JS에서 참조하는 시맨틱 맵)
// 색상 값 자체는 App.css 의 CSS 변수로 관리한다.

// 위험도 레벨 스타일 (위험구역 / 커뮤니티 신고글 배지)
export const LEVEL_STYLE = {
  HIGH:   { color: 'var(--danger)',  bg: 'rgba(225,29,72,.10)',  label: 'HIGH' },
  MEDIUM: { color: 'var(--warning)', bg: 'rgba(245,158,11,.13)', label: 'MEDIUM' },
  LOW:    { color: 'var(--safe)',    bg: 'rgba(16,185,129,.13)', label: 'LOW' },
}

// 같은 위험도를 카카오 지도에 그릴 때 쓰는 실제 색값.
// 지도 SDK 는 CSS 변수를 못 읽어서(캔버스/오버레이에 그대로 문자열로 들어간다) 리터럴이 필요하다.
// MapView 의 LEVEL_COLOR 와 같은 값이다 — 한쪽만 바꾸면 지도와 관리자 화면 색이 갈린다.
export const LEVEL_HEX = {
  HIGH:   '#E11D48',
  MEDIUM: '#F59E0B',
  LOW:    '#10B981',
}

// 커뮤니티 게시글 카테고리
export const POST_CATEGORY = {
  NOTICE:   { color: 'var(--blue-primary)', bg: 'var(--blue-tint)',      label: '공지' },
  INFO:     { color: 'var(--info)',         bg: 'var(--blue-tint)',      label: '정보' },
  QUESTION: { color: 'var(--warning)',      bg: 'rgba(245,158,11,.13)',  label: '질문' },
  TIP:      { color: 'var(--safe)',         bg: 'rgba(16,185,129,.13)',  label: '팁' },
  REPORT:   { color: 'var(--danger)',       bg: 'rgba(225,29,72,.10)',   label: '안전 신고' },
}
