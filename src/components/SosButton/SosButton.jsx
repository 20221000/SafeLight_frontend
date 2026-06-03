import { useState } from 'react'

export default function SosButton({ user }) {
  const [pressed, setPressed] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    if (confirmed || loading) return

    // 비로그인 체크
    if (!user) {
      alert('긴급 신고는 로그인이 필요합니다.')
      return
    }
    setPressed(true)
  }

  const handleConfirm = async () => {
    setLoading(true)

    try {
      // 1. 현재 위치 가져오기
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })

      const { latitude, longitude } = position.coords
      const token = localStorage.getItem('accessToken')

      // 2. 긴급신고 API 호출
      const res = await fetch('/emergency-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          description: '긴급 신고',
        }),
      })

      const json = await res.json()

      if (!json.success) {
        alert(json.error?.message || '신고 접수에 실패했습니다.')
        setPressed(false)
        return
      }

      // 3. 성공
      setConfirmed(true)
      setPressed(false)
      setTimeout(() => setConfirmed(false), 5000)

    } catch (err) {
      if (err.code === err.PERMISSION_DENIED) {
        alert('위치 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.')
      } else {
        alert('신고 접수 중 오류가 발생했습니다.')
      }
      setPressed(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div style={{
        position: 'absolute', bottom: '32px', left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '6px', zIndex: 100,
      }}>
        <button
          onClick={handleClick}
          style={{
            width: '72px', height: '72px', borderRadius: '50%',
            backgroundColor: confirmed ? '#00E676' : '#FF3B3B',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '15px', fontWeight: '800', color: 'white',
            boxShadow: confirmed
              ? '0 0 20px rgba(0,230,118,0.7), 0 0 40px rgba(0,230,118,0.3)'
              : '0 0 20px rgba(255,59,59,0.7), 0 0 40px rgba(255,59,59,0.3)',
            transition: 'all 0.2s', letterSpacing: '1px',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '...' : confirmed ? '✓' : 'SOS'}
        </button>
        <span style={{
          color: '#fff', fontSize: '12px', fontWeight: '600',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '2px 8px', borderRadius: '4px',
        }}>
          {confirmed ? '신고 완료' : '긴급 신고'}
        </span>
      </div>

      {/* 확인 모달 */}
      {pressed && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: '#161B27', borderRadius: '16px',
            padding: '32px 28px', textAlign: 'center',
            border: '1px solid #FF3B3B', maxWidth: '320px', width: '90%',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚨</div>
            <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
              긴급 신고를 접수할까요?
            </div>
            <div style={{ color: '#A0AEC0', fontSize: '13px', marginBottom: '24px', lineHeight: '1.6' }}>
              현재 위치가 허용된 친구 및<br />관계기관에 공유됩니다.
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setPressed(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  backgroundColor: '#1E2535', border: '1px solid #2D3748',
                  color: '#A0AEC0', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  backgroundColor: '#FF3B3B', border: 'none',
                  color: '#fff', fontSize: '14px', fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '접수 중...' : '신고하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}