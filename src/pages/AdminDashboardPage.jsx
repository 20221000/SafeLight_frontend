import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/layout/AdminShell'
import { adminStyles as s, LEVEL_STYLE, STATUS_STYLE } from '../components/Admin/adminStyles'
import { apiGet } from '../utils/adminApi'
import { fetchAllReports, computeReportStats } from '../utils/reportsAggregate'
import useIsMobile from '../hooks/useIsMobile'
import Icon from '../components/Icon'

const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '-')
const fmtShort = (iso) => (iso ? String(iso).slice(5, 16).replace('T', ' ') : '-')

export default function AdminDashboardPage({ user, onLogout }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [users, setUsers] = useState([])
  const [zones, setZones] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return
    let alive = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [userList, zoneList, reportList] = await Promise.all([
          apiGet('/users'),
          apiGet('/danger-zones'),
          fetchAllReports().catch(() => []),
        ])
        if (!alive) return
        setUsers(Array.isArray(userList) ? userList : [])
        setZones(Array.isArray(zoneList) ? zoneList : [])
        setReports(Array.isArray(reportList) ? reportList : [])
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [user])

  const reportStats = computeReportStats(reports)
  const blacklistCount = users.filter(u => u.isBlacklisted).length
  const recentUsers = [...users]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5)

  const kpis = [
    { icon: 'user',            label: '전체 사용자',   value: users.length, unit: '명', color: '#2563EB' },
    { icon: 'alert-triangle',  label: '활성 위험구역', value: zones.length, unit: '개', color: '#F59E0B' },
    { icon: 'ban',             label: '블랙리스트',     value: blacklistCount, unit: '명', color: '#E11D48' },
  ]

  // 모바일(AM1): KPI 2열 그리드 + 상태 분포 바 + 최근 긴급신고 카드.
  // 목업의 '전주 대비 증감'과 '신고 접수 추이' 차트는 넣지 않았다 —
  // 백엔드에 과거 스냅샷도, 해결 시각(resolvedAt)도 없어 정확한 시계열을 만들 수 없다(지어낼 수는 없음).
  if (isMobile) {
    const mainKpis = [
      { key: 'total', label: '총 신고', value: reportStats.total, color: 'var(--blue-primary)' },
      { key: 'processing', label: '처리중', value: reportStats.processing, color: 'var(--warning)' },
      { key: 'resolved', label: '해결', value: reportStats.resolved, color: 'var(--safe)' },
      { key: 'falseCount', label: '오탐', value: reportStats.falseCount, color: 'var(--danger)' },
    ]
    const dist = [
      { label: '해결', value: reportStats.resolved, color: 'var(--safe)' },
      { label: '처리중', value: reportStats.processing, color: 'var(--warning)' },
      { label: '오탐', value: reportStats.falseCount, color: 'var(--danger)' },
    ]
    const distTotal = dist.reduce((sum, d) => sum + d.value, 0)
    const recentReports = reports.slice(0, 5)

    const miniStat = (label, value, unit, to) => (
      <button
        onClick={() => navigate(to)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 48,
          padding: '0 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
          border: '1px solid var(--border)', background: 'var(--surface)',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Inter',sans-serif" }}>{loading ? '-' : `${value.toLocaleString()}${unit}`}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </span>
      </button>
    )

    return (
      <AdminShell user={user} onLogout={onLogout} active="dashboard" title="관리자 대시보드" subtitle="마포구 관제센터 · 실시간">
        {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

        {/* KPI 2열 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {mainKpis.map(k => (
            <div key={k.key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>{k.label}</span>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: k.color }} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Inter',sans-serif", letterSpacing: '-.5px', marginTop: 6 }}>
                {loading ? '-' : k.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* 상태 분포 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '15px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>상태 분포</div>
          <div style={{ display: 'flex', height: 9, borderRadius: 6, overflow: 'hidden', background: 'var(--bg)' }}>
            {distTotal > 0 && dist.map(d => (
              d.value > 0 ? <div key={d.label} style={{ width: `${(d.value / distTotal) * 100}%`, background: d.color }} /> : null
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 13 }}>
            {dist.map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, fontFamily: "'Inter',sans-serif" }}>{loading ? '-' : d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 사용자 · 위험구역 요약 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {miniStat('전체 사용자', users.length, '명', '/admin/users')}
          {miniStat('활성 위험구역', zones.length, '개', '/admin/dangerzones')}
          {miniStat('블랙리스트', blacklistCount, '명', '/admin/users')}
        </div>

        {/* 최근 긴급신고 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>최근 긴급신고</span>
          <button
            onClick={() => navigate('/admin/reports')}
            style={{ border: 'none', background: 'transparent', color: 'var(--blue-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >신고 관리 →</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: -6 }}>
          {recentReports.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? '불러오는 중…' : '최근 신고가 없습니다.'}
            </div>
          )}
          {recentReports.map(r => {
            const st = STATUS_STYLE[r.reportStatus] ?? { label: r.reportStatus, bg: 'var(--border)', color: 'var(--text-muted)' }
            return (
              <button
                key={r.reportId}
                onClick={() => navigate('/admin/reports')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '12px 14px', textAlign: 'left',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${st.color}`,
                  borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "'Inter',sans-serif", color: 'var(--text-strong)' }}>#ER-{r.reportId}</span>
                <span style={{ ...s.badge, backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.nickname ?? '-'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>{fmtShort(r.reportedAt)}</span>
              </button>
            )
          })}
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell user={user} onLogout={onLogout} active="dashboard" title="관리자 대시보드" subtitle="마포구 관제센터 · 실시간 현황">
      {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

      <div style={s.kpiRow}>
        {kpis.map(item => (
          <div key={item.label} style={s.kpiCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ ...s.kpiIcon, backgroundColor: item.color + '22' }}>
                <Icon name={item.icon} size={24} color={item.color} strokeWidth={2} />
              </div>
              <div>
                <div style={s.kpiLabel}>{item.label}</div>
                <div style={{ ...s.kpiValue, color: item.color }}>
                  {loading ? '-' : `${item.value.toLocaleString()}${item.unit}`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 신고 처리 현황 (활성 위험구역 기준 집계) */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={s.cardTitle}><Icon name="siren" size={16} color="var(--blue-primary)" /> 신고 처리 현황</span>
          <button style={s.btnGray} onClick={() => navigate('/admin/reports')}>신고 관리 →</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { key: 'total',      label: '전체 신고', value: reportStats.total,      color: '#2563EB' },
            { key: 'received',   label: '접수됨',    value: reportStats.received,   color: '#E11D48' },
            { key: 'processing', label: '처리중',    value: reportStats.processing, color: '#F59E0B' },
            { key: 'resolved',   label: '해결완료',  value: reportStats.resolved,   color: '#10B981' },
            { key: 'falseCount', label: '허위신고',  value: reportStats.falseCount, color: '#64748B' },
          ].map(item => (
            <div key={item.key} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ ...s.kpiLabel, marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Inter',sans-serif", letterSpacing: '-.5px', color: item.color }}>
                {loading ? '-' : `${item.value.toLocaleString()}건`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ ...s.card, flex: 1, minWidth: '360px' }}>
          <div style={s.cardTitle}><Icon name="user" size={16} color="var(--blue-primary)" /> 최근 가입 사용자</div>
          <table style={s.table}>
            <thead>
              <tr>{['닉네임', '아이디', '가입일', '허위신고', '상태'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {recentUsers.length > 0 ? recentUsers.map(u => (
                <tr key={u.userId} style={s.tr}>
                  <td style={s.td}>{u.nickname}</td>
                  <td style={s.td}>{u.username}</td>
                  <td style={s.td}>{fmtDate(u.createdAt)}</td>
                  <td style={{ ...s.td, color: (u.falseReportCount ?? 0) >= 2 ? 'var(--danger)' : 'var(--text-strong)' }}>
                    {u.falseReportCount ?? 0}회
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: u.isBlacklisted ? 'rgba(225,29,72,.10)' : 'rgba(16,185,129,.13)', color: u.isBlacklisted ? 'var(--danger)' : 'var(--safe)' }}>
                      {u.isBlacklisted ? '블랙리스트' : '정상'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={s.emptyRow}>{loading ? '불러오는 중…' : '사용자가 없습니다.'}</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: '10px' }}>
            <button style={s.btnGray} onClick={() => navigate('/admin/users')}>사용자 관리 →</button>
          </div>
        </div>

        <div style={{ ...s.card, flex: 1, minWidth: '360px' }}>
          <div style={s.cardTitle}><Icon name="map-pin" size={16} color="var(--blue-primary)" /> 활성 위험구역</div>
          <table style={s.table}>
            <thead>
              <tr>{['ID', '위험도', '반경', '신고수', '생성일'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {zones.length > 0 ? zones.slice(0, 5).map(z => (
                <tr key={z.dangerZoneId} style={s.tr}>
                  <td style={s.td}>#{z.dangerZoneId}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, backgroundColor: LEVEL_STYLE[z.dangerLevel]?.bg ?? '#4A5568', color: LEVEL_STYLE[z.dangerLevel]?.color ?? '#fff' }}>
                      {z.dangerLevel}
                    </span>
                  </td>
                  <td style={s.td}>{z.radius}m</td>
                  <td style={s.td}>{z.reportCount ?? 0}건</td>
                  <td style={s.td}>{fmtDate(z.createdAt)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={s.emptyRow}>{loading ? '불러오는 중…' : '활성 위험구역이 없습니다.'}</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: '10px' }}>
            <button style={s.btnGray} onClick={() => navigate('/admin/dangerzones')}>위험구역 관리 →</button>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
