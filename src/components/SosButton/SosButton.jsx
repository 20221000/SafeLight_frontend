// Safe Light 긴급 SOS (디자인 1) — 지도 중앙 하단 상시 버튼 + 3상태 오버레이
// 상태: 대기(idle) → 확인(dim + 3초 카운트다운, 다시 누르면 즉시 접수) → 완료(토스트)
// 백엔드 연동 보존: geolocation → POST /emergency-reports
import { useState, useRef, useEffect } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import useAuthNav from '../../hooks/useAuthNav'
import Icon from '../Icon'
import ConfirmDialog from '../layout/ConfirmDialog'
import { readEnvelope } from '../../utils/apiResponse'

// onReported: 접수가 성공한 직후 부른다. 이 신고 하나로 백엔드가 위험구역을 새로 만들거나
// (EmergencyReportService.createNewDangerZone) 기존 구역의 등급·신고수를 올리는데, 지도는
// 30초마다 도는 폴링으로만 그걸 알게 된다. 방금 내가 누른 신고가 30초 동안 화면에 없으면
// 접수가 안 된 것처럼 보인다 — 긴급 기능에서 제일 하면 안 되는 착각이다.
export default function SosButton({ user, onReported }) {
  const { goLogin } = useAuthNav()
  // 모바일에서는 지도를 너무 가려 대기 버튼을 데스크탑의 1/2 크기로 줄인다(88 → 44px).
  // 44px는 터치 타깃 최소 권장치와 같아 더 줄이지 않는다. 확인 오버레이는 오조작을 막아야 하므로 그대로 크게 둔다.
  const isMobile = useIsMobile()
  const SOS_SIZE = isMobile ? 44 : 88
  const [phase, setPhase] = useState('idle') // idle | confirm | done
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  // 실패·안내를 알리는 창. window.alert 은 브라우저가 그리는 시스템 대화상자라
  // 앱과 전혀 다르게 생겼고, 주소(127.0.0.1:5173)가 제목처럼 붙고, 무엇보다
  // '다시 시도'·'로그인' 같은 다음 행동을 붙일 수가 없다 — 긴급 기능에서 막다른 골목이 된다.
  const [dialog, setDialog] = useState(null)
  const timerRef = useRef(null)
  const doneTimerRef = useRef(null)
  // 접수가 진행 중인지 동기적으로 기록한다. loading 은 setState 라 다음 렌더까지 반영되지 않아
  // 연타 사이의 짧은 순간을 막지 못한다(같은 신고가 누른 횟수만큼 접수되던 원인).
  const submittingRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }
  useEffect(() => () => {
    clearTimer()
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
  }, [])

  const openConfirm = () => {
    if (loading) return
    if (!user) {
      setDialog({
        icon: 'user', title: '로그인이 필요합니다',
        message: '신고를 계정에 연결해야 담당자가 연락하고, 허용한 친구에게 위치를 보낼 수 있습니다.',
        confirmLabel: '로그인', onConfirm: () => { setDialog(null); goLogin() },
        cancelLabel: '닫기',
      })
      return
    }
    setPhase('confirm')
    clearTimer()
    timerRef.current = setTimeout(() => handleConfirm(), 3000) // 3초 후 자동 접수
  }

  const cancel = () => {
    clearTimer()
    setPhase('idle')
  }

  const handleConfirm = async () => {
    // 3초 자동 접수 타이머와 버튼 탭이 겹치거나 버튼을 연타하면 같은 신고가 여러 건 올라간다.
    // 접수가 끝날 때까지(성공·실패 모두) 두 번째 요청을 받지 않는다.
    if (submittingRef.current) return
    submittingRef.current = true
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
      const json = await readEnvelope(res)

      if (!json.success) {
        // 실패했으면 다시 누르는 게 유일한 다음 행동이다. 창을 닫고 버튼을 찾아 헤매게 두지 않는다.
        setDialog({
          danger: true, title: '신고를 접수하지 못했습니다',
          message: json.error?.message || json.message || '잠시 후 다시 시도해주세요.',
          confirmLabel: '다시 시도', onConfirm: () => { setDialog(null); handleConfirm() },
          cancelLabel: '닫기',
        })
        setPhase('idle')
        return
      }

      setResult(json.data || {})
      setPhase('done')
      // 폴링을 기다리지 않고 바로 다시 읽는다. 실패해도 접수 자체는 끝났으므로 화면은 건드리지 않는다.
      onReported?.()
      doneTimerRef.current = setTimeout(() => setPhase('idle'), 6000)
    } catch (err) {
      // 예전 판정은 `err.code === err.PERMISSION_DENIED` 였는데, 네트워크 오류처럼
      // 위치와 무관한 예외는 둘 다 undefined 라 참이 되어 엉뚱하게 "위치 권한" 안내가 떴다.
      // GeolocationPositionError 의 code 는 1/2/3 숫자다.
      const geo = typeof err?.code === 'number' ? err.code : null
      if (geo === 1) {
        setDialog({
          danger: true, icon: 'map-pin', title: '위치 권한이 꺼져 있습니다',
          message: '지금 어디 계신지 알 수 없어 신고를 보낼 수 없습니다. 주소창 왼쪽 자물쇠 → 위치 → 허용으로 바꾼 뒤 다시 눌러주세요.',
          confirmLabel: '확인', cancelLabel: null,
        })
      } else if (geo === 3) {
        // 실내·지하에서 흔하다. 사용자 잘못이 아니라는 걸 알려주고 재시도로 잇는다.
        setDialog({
          danger: true, icon: 'map-pin', title: '위치를 확인하지 못했습니다',
          message: '신호가 약한 곳에서는 시간이 더 걸릴 수 있습니다. 창가나 실외로 나가서 다시 시도해주세요.',
          confirmLabel: '다시 시도', onConfirm: () => { setDialog(null); handleConfirm() },
          cancelLabel: '닫기',
        })
      } else {
        setDialog({
          danger: true, title: '신고를 보내지 못했습니다',
          message: geo === 2
            ? '기기에서 위치를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.'
            : '네트워크 상태를 확인한 뒤 다시 시도해주세요.',
          confirmLabel: '다시 시도', onConfirm: () => { setDialog(null); handleConfirm() },
          cancelLabel: '닫기',
        })
      }
      setPhase('idle')
    } finally {
      setLoading(false)
      submittingRef.current = false
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
            {/* pointerEvents:none 필수 — 이 카운트다운 링은 아래 확인 버튼을 완전히 덮고 있어서
                이게 없으면 탭이 버튼이 아니라 링에 꽂혀 아무 반응이 없다(누르면 반응 없던 원인). */}
            <svg width="220" height="220" viewBox="0 0 130 130" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
              <circle cx="65" cy="65" r="61" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" />
              <circle cx="65" cy="65" r="61" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
                strokeDasharray="383" strokeDashoffset="0" style={{ animation: 'ls-count 3s linear forwards' }} />
            </svg>
            <button
              onClick={handleConfirm}
              disabled={loading}
              style={{
                width: 176, height: 176, borderRadius: '50%', background: 'var(--danger)', color: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer', border: '5px solid #fff',
                animation: loading ? 'none' : 'ls-sos 1.1s infinite',
              }}
            >
              {/* 위치 조회에 몇 초가 걸릴 수 있다. 그동안 화면이 그대로면 눌리지 않은 줄 알고 또 누른다. */}
              {loading ? (
                <>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" style={{ animation: 'ls-spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.2-8.5" strokeLinecap="round" /></svg>
                  <span style={{ fontSize: 17, fontWeight: 800, marginTop: 10 }}>접수 중...</span>
                  <span style={{ fontSize: 12, opacity: .85, marginTop: 4 }}>위치를 확인하고 있습니다</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.5px' }}>긴급 신고</span>
                  <span style={{ fontSize: 13, fontWeight: 600, opacity: .92, marginTop: 6 }}>한 번 더 누르면 신고됩니다</span>
                  <span style={{ fontSize: 11.5, opacity: .8, marginTop: 2 }}>3초 후 자동 접수</span>
                </>
              )}
            </button>
          </div>
          {/* 접수가 시작된 뒤로는 취소할 수 없다. 여기서 취소를 받아주면 신고는 그대로 올라가는데
              사용자는 취소된 줄 안다. */}
          <button
            onClick={cancel}
            disabled={loading}
            style={{
              height: 46, padding: '0 32px', borderRadius: 23, border: 'none', background: 'var(--surface)',
              color: 'var(--text-strong)', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .5 : 1,
              boxShadow: '0 6px 18px rgba(15,23,42,.25)', fontFamily: 'inherit',
            }}
          >취소</button>
        </div>
      )}

      {/* 완료 배너.
          예전엔 지도 위 20px 에 떠 있는 둥근 카드였는데, 아무 데도 닿지 않고 그림자만 짙어
          '붕 떠' 보였다. 지금은 화면 위쪽 끝에 붙여 위에서 내려온 알림으로 읽히게 한다
          (위 모서리는 각지고 아래만 둥글다 = 위쪽 화면에 물려 있다는 신호). */}
      {phase === 'done' && (
        <div style={{
          position: 'absolute', top: 0, zIndex: 200,
          ...(isMobile
            ? { left: 0, right: 0 }
            : { left: '50%', transform: 'translateX(-50%)', width: 560, maxWidth: 'calc(100% - 32px)' }),
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none',
            borderRadius: '0 0 16px 16px', overflow: 'hidden',
            boxShadow: '0 8px 22px rgba(15,23,42,.10)',
            animation: 'ls-drop .26s cubic-bezier(.16,.84,.44,1)',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: isMobile ? '13px 14px 12px' : '15px 18px 14px' }}>
              {/* 옅은 배경에 초록 아이콘이 아니라 꽉 찬 원 — 접수됐다는 결론을 한눈에 못 박는다. */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--safe)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </div>

              {/* minWidth:0 — 없으면 본문이 닫기(×) 버튼을 화면 밖으로 밀어낸다. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: isMobile ? 14.5 : 15.5, fontWeight: 800, letterSpacing: '-.3px' }}>긴급 신고가 접수되었습니다</span>
                  {/* 접수번호는 reportId 다(EmergencyReportResponse). emergencyReportId 라는 필드는 없어서
                      그걸 읽는 동안에는 이 배지가 한 번도 뜨지 않았다 — 사용자가 댈 번호가 없었다. */}
                  {result?.reportId != null && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, fontFamily: "'Inter',sans-serif", letterSpacing: '.2px',
                      color: 'var(--text-muted)', background: 'var(--bg)', border: '1px solid var(--border)',
                      padding: '1px 7px', borderRadius: 6,
                    }}>RP-{result.reportId}</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.55 }}>
                  허용한 친구에게 현재 위치를 보냈고, 관제센터로 신고가 전송되었습니다.
                </div>
                {/* 색 알약 두 개는 정보량에 비해 너무 시끄러웠다(빨강·파랑이 제목보다 먼저 눈에 들어왔다).
                    같은 내용을 한 줄 보조 텍스트로 낮춘다 — 사이렌만 '지금 켜져 있는 상태'라 점을 남긴다. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--danger)', animation: 'ls-blink 1.2s infinite' }} />
                    사이렌 켜짐
                  </span>
                  <span style={{ opacity: .45 }}>·</span>
                  <span>위험구역 자동 등록</span>
                </div>
              </div>

              <button
                onClick={() => setPhase('idle')}
                aria-label="닫기"
                style={{
                  border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  padding: 2, margin: -2, lineHeight: 1, display: 'flex', flexShrink: 0,
                }}
              ><Icon name="x" size={18} /></button>
            </div>

            {/* 남은 시간 막대 — 6초 뒤 저절로 사라지는데, 예고 없이 사라지면 놓쳤나 싶어진다.
                아래 doneTimer 와 같은 6초다. 한쪽을 바꾸면 다른 쪽도 바꿔야 한다. */}
            <div style={{
              height: 2, background: 'var(--safe)', transformOrigin: 'left',
              animation: 'ls-timebar 6s linear forwards',
            }} />
          </div>
        </div>
      )}

      {/* 안내·오류 — 시스템 alert 대신 앱 대화상자로 띄운다. 위치가 fixed 라 지도 컨테이너 밖에서도 가운데 뜬다. */}
      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title}
        message={dialog?.message}
        icon={dialog?.icon}
        danger={dialog?.danger}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        onConfirm={dialog?.onConfirm || (() => setDialog(null))}
        onCancel={() => setDialog(null)}
      />
    </>
  )
}
