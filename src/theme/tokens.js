// Light Safe 공용 디자인 토큰 헬퍼 (JS에서 참조하는 시맨틱 맵)
// 색상 값 자체는 App.css 의 CSS 변수로 관리한다.

// 위험도 레벨 스타일 (위험구역 / 커뮤니티 신고글 배지)
export const LEVEL_STYLE = {
  HIGH:   { color: 'var(--danger)',  bg: 'rgba(225,29,72,.10)',  label: 'HIGH' },
  MEDIUM: { color: 'var(--warning)', bg: 'rgba(245,158,11,.13)', label: 'MEDIUM' },
  LOW:    { color: 'var(--safe)',    bg: 'rgba(16,185,129,.13)', label: 'LOW' },
}

// 긴급신고 처리 상태 (관리자 신고 관리)
export const REPORT_STATUS = {
  RECEIVED:   { color: 'var(--info)',    bg: 'var(--blue-tint)',     label: '접수' },
  PROCESSING: { color: 'var(--warning)', bg: 'rgba(245,158,11,.13)', label: '처리중' },
  RESOLVED:   { color: 'var(--safe)',    bg: 'rgba(16,185,129,.13)', label: '해결' },
  FALSE:      { color: 'var(--text-muted)', bg: 'rgba(100,116,139,.12)', label: '오탐' },
}

// 커뮤니티 게시글 카테고리
export const POST_CATEGORY = {
  NOTICE:   { color: 'var(--blue-primary)', bg: 'var(--blue-tint)',      label: '공지' },
  INFO:     { color: 'var(--info)',         bg: 'var(--blue-tint)',      label: '정보' },
  QUESTION: { color: 'var(--warning)',      bg: 'rgba(245,158,11,.13)',  label: '질문' },
  TIP:      { color: 'var(--safe)',         bg: 'rgba(16,185,129,.13)',  label: '팁' },
  REPORT:   { color: 'var(--danger)',       bg: 'rgba(225,29,72,.10)',   label: '안전 신고' },
}
