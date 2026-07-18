// 카카오맵 커스텀 오버레이(React 밖, 문자열 HTML)에서 쓰는 SVG 문자열 생성기.
// React <Icon> 과 달리 stroke=currentColor 를 못 쓰므로 색을 인자로 받아 직접 박는다.
// (fast-refresh 규칙상 컴포넌트 파일과 분리해 둔다.)
const PATHS = {
  'map-pin': '<path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  'alert-triangle': '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
}

export function iconSvg(name, { size = 16, color = '#fff', strokeWidth = 2 } = {}) {
  const d = PATHS[name]
  if (!d) return ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.15em">${d}</svg>`
}
