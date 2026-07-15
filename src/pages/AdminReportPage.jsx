import { useState, useEffect, useCallback, useMemo } from 'react'
import AdminShell from '../components/layout/AdminShell'
import { adminStyles as s, LEVEL_STYLE, STATUS_STYLE } from '../components/Admin/adminStyles'
import { apiSend } from '../utils/adminApi'
import { fetchAllReports, computeReportStats } from '../utils/reportsAggregate'

const fmtDateTime = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '-')

// 상태 필터 옵션 (label ↔ 백엔드 코드)
const STATUS_OPTIONS = [
  { code: 'ALL',        label: '전체 상태' },
  { code: 'RECEIVED',   label: '접수됨' },
  { code: 'PROCESSING', label: '처리중' },
  { code: 'RESOLVED',   label: '해결완료' },
  { code: 'FALSE',      label: '허위신고' },
]

export default function AdminReportPage({ user, onLogout }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!user || user.role !== 'ADMIN') return
    setLoading(true)
    setError(null)
    try {
      setReports(await fetchAllReports())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const setStatus = async (report, status) => {
    try {
      await apiSend(`/emergency-reports/${report.reportId}/status`, 'PATCH', { reportStatus: status })
      await load()
    } catch (e) {
      alert('상태 변경 실패: ' + e.message)
    }
  }

  const markFalse = async (report) => {
    if (!window.confirm(`신고 #${report.reportId}을(를) 허위신고로 처리할까요? 신고자의 허위신고 횟수가 증가합니다.`)) return
    try {
      await apiSend(`/emergency-reports/${report.reportId}/false-report`, 'PATCH')
      await load()
    } catch (e) {
      alert('허위신고 처리 실패: ' + e.message)
    }
  }

  // KPI 집계
  const stats = useMemo(() => computeReportStats(reports), [reports])

  const filtered = useMemo(() => reports.filter(r => {
    const matchStatus = statusFilter === 'ALL' || r.reportStatus === statusFilter
    const q = search.trim().toLowerCase()
    const matchSearch = !q || [r.nickname, r.description, r.reportId]
      .some(v => String(v ?? '').toLowerCase().includes(q))
    return matchStatus && matchSearch
  }), [reports, statusFilter, search])

  const kpiCards = [
    { key: 'total',      icon: '🚨', label: '전체 신고', value: stats.total,      color: '#2563EB' },
    { key: 'received',   icon: '🔴', label: '접수됨',    value: stats.received,   color: '#E11D48' },
    { key: 'processing', icon: '🟠', label: '처리중',    value: stats.processing, color: '#F59E0B' },
    { key: 'resolved',   icon: '✅', label: '해결완료',  value: stats.resolved,   color: '#10B981' },
    { key: 'falseCount', icon: '🚫', label: '허위신고',  value: stats.falseCount, color: '#64748B' },
  ]

  return (
    <AdminShell user={user} onLogout={onLogout} active="reports" title="신고 관리" subtitle="원클릭 긴급신고 접수·처리 현황">
      {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        {kpiCards.map(item => (
          <div key={item.key} style={s.kpiCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ ...s.kpiIcon, backgroundColor: item.color + '22' }}>
                <span style={{ fontSize: '22px' }}>{item.icon}</span>
              </div>
              <div>
                <div style={s.kpiLabel}>{item.label}</div>
                <div style={{ ...s.kpiValue, color: item.color }}>
                  {loading ? '-' : `${item.value.toLocaleString()}건`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <input
          style={s.searchInput}
          placeholder="신고자 / 내용 / 신고번호 검색…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            style={{ ...s.input, width: 'auto', cursor: 'pointer' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>총 {filtered.length}건</span>
        </div>
      </div>

      {/* 신고 테이블 */}
      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>{['신고번호', '신고자', '상태', '위험구역', '위험도', '좌표', '내용', '발생시각', '관리']
              .map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(r => (
              <tr key={r.reportId} style={s.tr}>
                <td style={s.td}>#ER-{r.reportId}</td>
                <td style={s.td}>{r.nickname ?? '-'}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, backgroundColor: STATUS_STYLE[r.reportStatus]?.bg ?? '#4A5568', color: STATUS_STYLE[r.reportStatus]?.color ?? '#fff' }}>
                    {STATUS_STYLE[r.reportStatus]?.label ?? r.reportStatus}
                  </span>
                </td>
                <td style={s.td}>#{r.dangerZoneId}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, backgroundColor: LEVEL_STYLE[r.dangerLevel]?.bg ?? '#4A5568', color: LEVEL_STYLE[r.dangerLevel]?.color ?? '#fff' }}>
                    {LEVEL_STYLE[r.dangerLevel]?.label ?? r.dangerLevel ?? '-'}
                  </span>
                </td>
                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                  {r.latitude != null ? `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}` : '-'}
                </td>
                <td style={{ ...s.td, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description ?? ''}>
                  {r.description || '-'}
                </td>
                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmtDateTime(r.reportedAt)}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={s.btnOrange} onClick={() => setStatus(r, 'PROCESSING')} disabled={r.reportStatus === 'PROCESSING' || r.isFalseReport}>처리중</button>
                    <button style={s.btnMint} onClick={() => setStatus(r, 'RESOLVED')} disabled={r.reportStatus === 'RESOLVED' || r.isFalseReport}>해결완료</button>
                    <button style={s.btnRed} onClick={() => markFalse(r)} disabled={r.isFalseReport}>
                      {r.isFalseReport ? '허위신고됨' : '허위신고'}
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9} style={s.emptyRow}>{loading ? '불러오는 중…' : '신고 데이터가 없습니다.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}
