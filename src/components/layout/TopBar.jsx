// Light Safe 유저 상단 글로벌 바 (60px) — 로고 · (중앙)검색 · 현재위치 · 알림 · 야간모드 · 프로필
// 검색/현재위치는 PlaceSearchBox가 담당한다(모바일 헤더와 공유).
import { useNavigate } from 'react-router-dom'
import PlaceSearchBox from './PlaceSearchBox'
import useRegionName from '../../hooks/useRegionName'

export default function TopBar({ user, dark, onToggleDark, onPickPlace }) {
  const navigate = useNavigate()

  const nickname = user?.nickname || user?.username || '게스트'
  const initial = nickname.charAt(0)
  // 백엔드 UserResponse에 지역 필드가 없어 현재 위치를 역지오코딩해 쓴다. 위치를 못 얻으면 표기를 비운다.
  const region = useRegionName()

  return (
    <header style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, padding: '0 20px',
      background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 20,
    }}>
      {/* 로고 (좌측) */}
      <div
        onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: 180, cursor: 'pointer', flexShrink: 0 }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: 'var(--blue-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(37,99,235,.35)',
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
        </div>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-.2px' }}>Light Safe</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>실시간 안전 지도</div>
        </div>
      </div>

      {/* 검색 + 현재 위치 (화면 상단 중앙 고정) */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(560px, calc(100% - 480px))', zIndex: 25,
      }}>
        <PlaceSearchBox onPickPlace={onPickPlace} />
      </div>

      {/* 알림 · 야간모드 · 프로필 (우측) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button style={{
          position: 'relative', width: 40, height: 40, borderRadius: 11, border: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid var(--surface)' }} />
        </button>
        <button
          onClick={onToggleDark}
          title="야간 모드"
          style={{
            width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            border: `1px solid ${dark ? 'var(--blue-primary)' : 'var(--border)'}`,
            background: dark ? 'var(--blue-primary)' : 'var(--surface)',
            color: dark ? '#fff' : 'var(--text-muted)',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
        </button>
        <div
          onClick={() => navigate('/myinfo')}
          style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 6, cursor: 'pointer' }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#1E40AF)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600,
          }}>{initial}</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{nickname}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{region}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
