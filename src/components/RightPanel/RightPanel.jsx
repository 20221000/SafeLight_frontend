import { useState, useEffect } from 'react'

const LEVEL_STYLE = {
  HIGH:   { bg: '#FF3B3B', color: '#fff' },
  MEDIUM: { bg: '#FF9500', color: '#fff' },
  LOW:    { bg: '#00E676', color: '#000' },
}

export default function RightPanel({ safetyStats, dangerZones, lastUpdated, isLoading }) {
  const [timeAgo, setTimeAgo] = useState('방금 전')

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
      if (diff < 10)      setTimeAgo('방금 전')
      else if (diff < 60) setTimeAgo(`${diff}초 전`)
      else                setTimeAgo(`${Math.floor(diff / 60)}분 전`)
    }
    update()
    const t = setInterval(update, 10_000)
    return () => clearInterval(t)
  }, [lastUpdated])

  const score = safetyStats?.safetyScore ?? 85
  const scoreColor = score >= 80 ? '#00E676' : score >= 60 ? '#FF9500' : '#FF3B3B'
  const scoreLabel = score >= 80 ? '우수' : score >= 60 ? '보통' : '위험'
  const s = styles

  return (
    <aside style={s.panel}>
      <div style={s.card}>
        <div style={s.cardHeaderRow}>
          <span style={s.cardTitle}>내 주변 안전 현황</span>
          <div style={s.liveRow}>
            <span style={{
              ...s.liveDot,
              backgroundColor: isLoading ? '#FFD600' : '#00E676',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={s.liveText}>
              {isLoading ? '업데이트 중...' : `${timeAgo} 업데이트`}
            </span>
          </div>
        </div>

        <div style={s.statsRow}>
          <StatBox icon="📷" label="CCTV"  value={`${safetyStats?.cctv ?? 23}개`} />
          <StatBox icon="💡" label="가로등" value={`${safetyStats?.streetLamp ?? 41}개`} />
          <StatBox icon="🏪" label="편의점" value={`${safetyStats?.convenience ?? 8}개`} />
        </div>

        <div style={s.scoreRow}>
          <span style={s.scoreLabel}>안전도</span>
          <div style={s.scoreBar}>
            <div style={{
              ...s.scoreBarFill,
              width: `${score}%`,
              backgroundColor: scoreColor,
              transition: 'width 0.6s ease, background-color 0.3s',
            }} />
          </div>
          <span style={{ ...s.scoreValue, color: scoreColor }}>{scoreLabel}</span>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>① 근처 위험 구역</div>
        {dangerZones.length === 0 && (
          <div style={{ color: '#A0AEC0', fontSize: '12px', padding: '8px 0' }}>
            주변 위험 구역 없음
          </div>
        )}
        {dangerZones.map(zone => (
          <div key={zone.dangerZoneId} style={s.zoneItem}>
            <div style={s.zoneTopRow}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: LEVEL_STYLE[zone.level]?.bg ?? '#FF9500',
                display: 'inline-block', flexShrink: 0,
              }} />
              <span style={s.zoneName}>{zone.name}</span>
            </div>
            <div style={s.zoneBottomRow}>
              <span style={{
                ...s.levelBadge,
                backgroundColor: LEVEL_STYLE[zone.level]?.bg ?? '#FF9500',
                color: LEVEL_STYLE[zone.level]?.color ?? '#fff',
              }}>
                {zone.level}
              </span>
              <span style={s.zoneDistance}>{zone.distance}</span>
              <button style={s.mapViewBtn}>지도 보기 ↗</button>
            </div>
          </div>
        ))}
      </div>

      <div style={s.footer}>
        <span style={s.liveIndicator}>● LIVE</span>
        <span style={s.footerText}>실시간 안전 정보 자동 업데이트 중</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </aside>
  )
}

function StatBox({ icon, label, value }) {
  return (
    <div style={{
      flex: 1, backgroundColor: '#0D1117', borderRadius: '8px',
      padding: '10px 6px', textAlign: 'center', border: '1px solid #1E2535',
    }}>
      <div style={{ fontSize: '18px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ color: '#A0AEC0', fontSize: '11px', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700' }}>{value}</div>
    </div>
  )
}

const styles = {
  panel: {
    width: '300px', flexShrink: 0, height: '100vh',
    backgroundColor: '#0D1117', borderLeft: '1px solid #1E2535',
    display: 'flex', flexDirection: 'column',
    padding: '16px 12px', overflowY: 'auto', gap: '10px',
  },
  card: {
    backgroundColor: '#161B27', borderRadius: '12px',
    padding: '14px', border: '1px solid #1E2535',
  },
  cardHeaderRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: '12px',
  },
  cardTitle: { color: '#fff', fontSize: '13px', fontWeight: '600' },
  liveRow: { display: 'flex', alignItems: 'center', gap: '5px' },
  liveDot: { width: '7px', height: '7px', borderRadius: '50%' },
  liveText: { color: '#A0AEC0', fontSize: '10px' },
  statsRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' },
  scoreLabel: { color: '#A0AEC0', fontSize: '11px', whiteSpace: 'nowrap' },
  scoreBar: {
    flex: 1, height: '6px', backgroundColor: '#1E2535',
    borderRadius: '3px', overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: '3px' },
  scoreValue: { fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' },
  zoneItem: {
    backgroundColor: '#0D1117', borderRadius: '8px',
    padding: '10px', marginTop: '8px', border: '1px solid #1E2535',
  },
  zoneTopRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  zoneName: { color: '#fff', fontSize: '13px', fontWeight: '500' },
  zoneBottomRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  levelBadge: {
    fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px',
  },
  zoneDistance: { color: '#A0AEC0', fontSize: '12px', flex: 1 },
  mapViewBtn: {
    background: 'none', border: 'none', color: '#00E676',
    fontSize: '12px', cursor: 'pointer', padding: 0,
  },
  footer: {
    marginTop: 'auto', paddingTop: '8px',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  liveIndicator: { color: '#00E676', fontSize: '10px', fontWeight: '700' },
  footerText: { color: '#A0AEC0', fontSize: '11px' },
}