// 신고 위치 표기 — 주소를 앞세우고 좌표는 옆(또는 아래)에 작게 남긴다.
//
// 백엔드가 주는 건 위경도뿐이라 예전에는 "37.50123, 127.00456" 만 찍혔다.
// 숫자 두 개로는 어디인지 알 수 없어 카카오 SDK 로 주소를 붙인다 — [utils/geocode.js]
// 좌표를 지우지는 않는다. 관리자가 다른 지도에 찍어 보거나 신고끼리 대조할 때 쓰는 값이다.
import { useState, useEffect } from 'react'
import { lookupAddress, cachedAddress, fmtCoord, coordKey } from '../utils/geocode'

export default function LocationText({
  lat,
  lng,
  stack = false,       // true 면 주소 아래에 좌표를 놓는다(표 셀처럼 가로가 좁을 때)
  addressSize = 13,
  coordSize = 11,
  addressWeight = 600,
}) {
  // 어느 좌표의 답인지 함께 들고 있는다. 좌표가 바뀌는 순간(표 페이지 넘김 등)
  // 이전 좌표의 주소를 잠깐이라도 보여주면 엉뚱한 곳이 찍힌다.
  const [entry, setEntry] = useState(() => ({ key: coordKey(lat, lng), value: cachedAddress(lat, lng) }))

  useEffect(() => {
    if (lat == null || lng == null) return
    let alive = true
    const key = coordKey(lat, lng)
    lookupAddress(lat, lng).then(value => { if (alive) setEntry({ key, value }) })
    return () => { alive = false }
  }, [lat, lng])

  if (lat == null || lng == null) return <span style={{ color: 'var(--text-muted)' }}>-</span>

  // 캐시는 렌더 중에 읽는다. 이미 물어본 좌표면 첫 렌더부터 주소가 있어 글자가 깜빡이지 않는다.
  const key = coordKey(lat, lng)
  const address = entry.key === key ? entry.value : cachedAddress(lat, lng)

  // undefined = 아직 조회 중, null = 주소가 없는 곳(바다·산속 등).
  // 조회 중에는 좌표만 보여준다. '불러오는 중' 문구를 넣으면 표가 그 문구로 뒤덮인다.
  const addressText = address === undefined ? null : (address || '주소를 찾을 수 없는 위치')

  const coordEl = (
    <span style={{
      fontSize: coordSize, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif",
      whiteSpace: 'nowrap',
    }}>
      {fmtCoord(lat, lng)}
    </span>
  )

  if (!addressText) return coordEl

  return (
    <span style={{
      display: stack ? 'block' : 'inline-flex',
      ...(stack ? null : { alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }),
      minWidth: 0,
    }}>
      <span style={{
        fontSize: addressSize, fontWeight: addressWeight, color: 'var(--text-strong)',
        wordBreak: 'keep-all',
      }}>
        {addressText}
      </span>
      {stack ? <span style={{ display: 'block', marginTop: 2 }}>{coordEl}</span> : coordEl}
    </span>
  )
}
