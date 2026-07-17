// 장소 검색 (카카오 Places) — 데스크탑 TopBar와 모바일 헤더가 공유한다.
// 장소 선택 시: onPickPlace 가 있으면 위임, 없으면 지도 페이지('/')로 이동하며 router state 로 전달.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// showCurrentLocation: 모바일 헤더에서는 끈다(지도에 동일한 '현재 위치로' 플로팅 버튼이 이미 있다).
export default function PlaceSearchBox({ onPickPlace, compact = false, showCurrentLocation = true }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [results, setResults] = useState([])

  const runSearch = (keyword, onOk) => {
    if (!keyword.trim() || !window.kakao?.maps?.services) return
    const ps = new window.kakao.maps.services.Places()
    ps.keywordSearch(keyword, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        onOk(data.map(p => ({
          name: p.place_name,
          address: p.road_address_name || p.address_name,
          lat: parseFloat(p.y),
          lng: parseFloat(p.x),
        })))
      } else {
        onOk([])
      }
    })
  }

  const deliver = (place) => {
    setValue(place.name)
    setResults([])
    if (onPickPlace) onPickPlace(place)
    else navigate('/', { state: { searchPlace: place } })
  }

  const handleChange = (v) => {
    setValue(v)
    if (v.trim()) runSearch(v, list => setResults(list.slice(0, 5)))
    else setResults([])
  }

  const handleSubmit = () => {
    if (results.length > 0) { deliver(results[0]); return }
    runSearch(value, list => { if (list.length) deliver(list[0]) })
  }

  const handleCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      deliver({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: '현재 위치' })
    })
  }

  // compact(모바일 헤더)는 로고·야간모드 버튼과 같은 38px. 헤더가 흰색이라 배경은 데스크탑과 같이
  // var(--bg)를 써야 입력 필드로 읽힌다(흰색이면 옆의 흰 버튼과 한 덩어리로 보인다).
  const height = compact ? 38 : 40

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      {/* minWidth:0 필수 — flex 기본 min-width:auto면 input 고유폭(약 179px) 아래로 줄지 못해
          좁은 화면에서 검색 박스가 칸을 넘어 옆 버튼을 덮는다. */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, height, padding: compact ? '0 12px' : '0 14px',
          background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 11,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
          <input
            value={value}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            placeholder={compact ? '장소 검색' : '장소 검색 (도로명 · 건물명)'}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, color: 'var(--text-strong)', fontFamily: 'inherit' }}
          />
        </div>
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: height + 6, left: 0, right: 0, zIndex: 40, overflow: 'hidden',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: 'var(--shadow)',
          }}>
            {results.map((p, i) => (
              <div
                key={i}
                onMouseDown={() => deliver(p)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{p.name}</span>
                {p.address && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.address}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {showCurrentLocation && (
      <button
        onClick={handleCurrentLocation}
        title="현재 위치"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          height, width: compact ? height : 'auto', padding: compact ? 0 : '0 13px',
          background: 'var(--blue-tint)', color: 'var(--blue-primary)', border: '1px solid transparent',
          borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" /></svg>
        {!compact && '현재 위치'}
      </button>
      )}
    </div>
  )
}
