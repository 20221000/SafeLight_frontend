// Light Safe 우측 안전 드로어 (디자인 A) — 근처 위험 구역 (열기/닫기 토글)
// 백엔드 DangerZoneResponse 실제 필드만 사용: dangerZoneId, centerLat/Lng, dangerLevel, reportCount, radius, isActive
import { useState } from 'react'
import { LEVEL_STYLE } from '../../theme/tokens'

export default function RightPanel({ dangerZones = [], isLoading = false }) {
  const [open, setOpen] = useState(true) // 우측 안전 현황 열기/닫기
  const activeZones = dangerZones.filter(z => z.isActive)

  return (
    <div style={{ position: 'relative', flexShrink: 0, height: '100%' }}>
      {/* 열기/닫기 토글 핸들 */}
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? '패널 닫기' : '안전 현황 열기'}
        style={{
          position: 'absolute', top: 16, left: -15, zIndex: 6,
          width: 30, height: 46, padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRight: 'none',
          borderRadius: '10px 0 0 10px', color: 'var(--text-muted)', boxShadow: '-2px 0 8px rgba(15,23,42,.06)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'none' : 'rotate(180deg)' }}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      <aside className="ls-scroll" style={{
        width: open ? 320 : 0, height: '100%',
        overflowY: open ? 'auto' : 'hidden', overflowX: 'hidden',
        background: 'var(--surface)', borderLeft: open ? '1px solid var(--border)' : 'none',
        transition: 'width .3s ease',
      }}>
        <div style={{ width: 320 }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px',
        position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.2px' }}>내 주변 안전 현황</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>반경 500m · 마포구 서교동</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,.12)', color: 'var(--safe)',
          fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 20,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--safe)', animation: 'ls-blink 1.6s infinite' }} />
          {isLoading ? '갱신중' : 'LIVE'}
        </div>
      </div>

      {/* 근처 위험 구역 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 10px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>근처 위험 구역</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeZones.length}건</div>
      </div>
      <div style={{ padding: '0 18px 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {activeZones.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 0' }}>
            주변에 등록된 위험 구역이 없습니다.
          </div>
        )}
        {activeZones.map(z => {
          const lv = LEVEL_STYLE[z.dangerLevel] ?? LEVEL_STYLE.LOW
          return (
            <div key={z.dangerZoneId} style={{
              border: '1px solid var(--border)', borderLeft: `4px solid ${lv.color}`, borderRadius: 12,
              padding: '12px 13px', background: 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.2px' }}>위험구역 #{z.dangerZoneId}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif", marginTop: 2 }}>
                    {Number(z.centerLatitude).toFixed(4)}, {Number(z.centerLongitude).toFixed(4)}
                  </div>
                </div>
                <span style={{
                  flexShrink: 0, background: lv.bg, color: lv.color, fontSize: 10.5, fontWeight: 800,
                  letterSpacing: '.4px', padding: '3px 8px', borderRadius: 7, fontFamily: "'Inter',sans-serif",
                }}>{lv.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
                신고 {z.reportCount ?? 0}건 · 반경 {z.radius ?? 0}m
              </div>
            </div>
          )
        })}
      </div>
        </div>
      </aside>
    </div>
  )
}
