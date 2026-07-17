// Light Safe 긴급 SOS (디자인 1) — 지도 중앙 하단 상시 버튼 + 3상태 오버레이
// 상태: 대기(idle) → 확인(dim + 3초 카운트다운, 다시 누르면 즉시 접수) → 완료(토스트)
// 백엔드 연동 보존: geolocation → POST /emergency-reports
import { useState, useRef, useEffect } from 'react'
import useIsMobile from '../../hooks/useIsMobile'

export default function SosButton({ user }) {
  // 모바일에서는 지도를 너무 가려 대기 버튼을 데스크탑의 1/2 크기로 줄인다(88 → 44px).
  // 44px는 터치 타깃 최소 권장치와 같아 더 줄이지 않는다. 확인 오버레이는 오조작을 막아야 하므로 그대로 크게 둔다.
  const isMobile = useIsMobile()
  const SOS_SIZE = isMobile ? 44 : 88
  const [phase, setPhase] = useState('idle') // idle | confirm | done
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const timerRef = useRef(null)

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }
  useEffect(() => clearTimer, [])

  const openConfirm = () => {
    if (loading) return
    if (!user) { alert('긴급 신고는 로그인이 필요합니다.'); return }
    setPhase('confirm')
    clearTimer()
    timerRef.current = setTimeout(() => handleConfirm(), 3000) // 3초 후 자동 접수
  }

  const cancel = () => {
    clearTimer()
    setPhase('idle')
  }

  const handleConfirm = async () => {
    clearTimer()
    setLoading(true)
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        })
      })
      const { latitude, longitude } = position.coords
      const token = localStorage.getItem('accessToken')

      const res = await fetch('/emergency-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ latitude, longitude, description: '긴급 신고' }),
      })
      const json = await res.json()

      if (!json.success) {
        alert(json.error?.message || json.message || '신고 접수에 실패했습니다.')
        setPhase('idle')
        return
      }

      setResult(json.data || {})
      setPhase('done')
      setTimeout(() => setPhase('idle'), 6000)
    } catch (err) {
      if (err.code === err.PERMISSION_DENIED) {
        alert('위치 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.')
      } else {
        alert('신고 접수 중 오류가 발생했습니다.')
      }
      setPhase('idle')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* 대기 버튼 (지도 중앙 하단 상시 노출) */}
      {phase !== 'confirm' && (
        <div style={{
          position: 'absolute', bottom: `calc(${isMobile ? 14 : 26}px + var(--ls-sheet-peek, 0px))`, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 6 : 9, zIndex: 100,
        }}>
          <button
            onClick={openConfirm}
            style={{
              width: SOS_SIZE, height: SOS_SIZE, borderRadius: '50%', background: 'var(--danger)', color: '#fff',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer', border: `${isMobile ? 2 : 4}px solid #fff`,
              animation: phase === 'idle' ? 'ls-sos 2s infinite' : 'none',
              boxShadow: isMobile ? '0 5px 14px rgba(225,29,72,.45)' : '0 10px 26px rgba(225,29,72,.5)',
            }}
          >
            {loading ? (
              <svg width={isMobile ? 18 : 26} height={isMobile ? 18 : 26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" style={{ animation: 'ls-spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.2-8.5" strokeLinecap="round" /></svg>
            ) : isMobile ? (
              // 44px 안에 아이콘과 글자를 같이 넣으면 둘 다 못 알아보므로 글자만 남긴다.
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-.3px' }}>긴급</span>
            ) : (
              <>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.6" fill="#fff" stroke="none" /></svg>
                <span style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>긴급</span>
              </>
            )}
          </button>
          {phase === 'idle' && (
            <span style={{
              fontSize: isMobile ? 10.5 : 12, fontWeight: 600, color: 'var(--text-strong)', background: 'var(--surface)',
              border: '1px solid var(--border)', padding: isMobile ? '3px 8px' : '4px 11px', borderRadius: 20, boxShadow: 'var(--shadow)',
            }}>위급 상황 시 눌러주세요</span>
          )}
        </div>
      )}

      {/* 확인 오버레이 (지도 디밍 + 카운트다운) */}
      {phase === 'confirm' && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 200,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22,
        }}>
          <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="220" height="220" viewBox="0 0 130 130" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="65" cy="65" r="61" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" />
              <circle cx="65" cy="65" r="61" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
                strokeDasharray="383" strokeDashoffset="0" style={{ animation: 'ls-count 3s linear forwards' }} />
            </svg>
            <button
              onClick={handleConfirm}
              style={{
                width: 176, height: 176, borderRadius: '50%', background: 'var(--danger)', color: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: '5px solid #fff', animation: 'ls-sos 1.1s infinite',
              }}
            >
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.5px' }}>긴급 신고</span>
              <span style={{ fontSize: 13, fontWeight: 600, opacity: .92, marginTop: 6 }}>한 번 더 누르면 신고됩니다</span>
              <span style={{ fontSize: 11.5, opacity: .8, marginTop: 2 }}>3초 후 자동 접수</span>
            </button>
          </div>
          <button
            onClick={cancel}
            style={{
              height: 46, padding: '0 32px', borderRadius: 23, border: 'none', background: 'var(--surface)',
              color: 'var(--text-strong)', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(15,23,42,.25)', fontFamily: 'inherit',
            }}
          >취소</button>
        </div>
      )}

      {/* 완료 토스트 */}
      {phase === 'done' && (
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', width: 520, maxWidth: '90%',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, zIndex: 200,
          boxShadow: '0 12px 34px rgba(15,23,42,.16)', padding: '20px 22px', display: 'flex', gap: 16, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14, background: 'rgba(16,185,129,.13)', color: 'var(--safe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          {/* minWidth:0 — 없으면 좁은 화면에서 토스트 본문이 닫기(×) 버튼을 밀어낸다. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-.3px' }}>긴급 신고가 접수되었습니다</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.7 }}>
              허용된 친구에게 현재 위치가 공유되었습니다.<br />
              관제센터로 신고가 전송되었습니다
              {result?.emergencyReportId != null && (
                <> · 신고번호 <b style={{ color: 'var(--text-strong)', fontFamily: "'Inter',sans-serif" }}>RP-{result.emergencyReportId}</b></>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(225,29,72,.10)', color: 'var(--danger)', fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', animation: 'ls-blink 1.2s infinite' }} />🔊 사이렌 켜짐
              </span>
              <span style={{ background: 'var(--blue-tint)', color: 'var(--blue-primary)', fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 20 }}>📍 위험구역 자동 등록</span>
            </div>
          </div>
          <div onClick={() => setPhase('idle')} style={{ color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</div>
        </div>
      )}
    </>
  )
}
