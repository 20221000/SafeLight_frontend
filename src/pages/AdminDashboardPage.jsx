import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/layout/AdminShell'
import { adminStyles as s, LEVEL_STYLE } from '../components/Admin/adminStyles'
import { apiGet } from '../utils/adminApi'
import { fetchAllReports, computeReportStats } from '../utils/reportsAggregate'

const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '-')

export default function AdminDashboardPage({ user, onLogout }) {
  const navigate = useNavigate()
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
    { icon: '👤', label: '전체 사용자',   value: users.length, unit: '명', color: '#2563EB' },
    { icon: '⚠️', label: '활성 위험구역', value: zones.length, unit: '개', color: '#F59E0B' },
    { icon: '🚫', label: '블랙리스트',     value: blacklistCount, unit: '명', color: '#E11D48' },
  ]

  return (
    <AdminShell user={user} onLogout={onLogout} active="dashboard" title="관리자 대시보드" subtitle="마포구 관제센터 · 실시간 현황">
      {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

      <div style={s.kpiRow}>
        {kpis.map(item => (
          <div key={item.label} style={s.kpiCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ ...s.kpiIcon, backgroundColor: item.color + '22' }}>
                <span style={{ fontSize: '24px' }}>{item.icon}</span>
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
          <span style={s.cardTitle}>🚨 신고 처리 현황</span>
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
          <div style={s.cardTitle}>👤 최근 가입 사용자</div>
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
          <div style={s.cardTitle}>📍 활성 위험구역</div>
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
