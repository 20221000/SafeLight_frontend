import { useState, useEffect, useCallback, useMemo } from 'react'
import AdminShell from '../components/layout/AdminShell'
import ActionSheet from '../components/layout/ActionSheet'
import { adminStyles as s, LEVEL_STYLE, STATUS_STYLE } from '../components/Admin/adminStyles'
import { apiSend } from '../utils/adminApi'
import { fetchAllReports, computeReportStats } from '../utils/reportsAggregate'
import useIsMobile from '../hooks/useIsMobile'

const fmtDateTime = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '-')
// 모바일 카드는 공간이 좁아 날짜 대신 'MM-DD HH:mm'
const fmtShort = (iso) => (iso ? String(iso).slice(5, 16).replace('T', ' ') : '-')

// 상태 필터 옵션 (label ↔ 백엔드 코드)
const STATUS_OPTIONS = [
  { code: 'ALL',        label: '전체 상태' },
  { code: 'RECEIVED',   label: '접수됨' },
  { code: 'PROCESSING', label: '처리중' },
  { code: 'RESOLVED',   label: '해결완료' },
  { code: 'FALSE',      label: '허위신고' },
]

export default function AdminReportPage({ user, onLogout }) {
  const isMobile = useIsMobile()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sheetReport, setSheetReport] = useState(null) // 모바일 '⋮' 액션 시트 대상

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

  // 모바일(AM2): 데스크탑 테이블 대신 카드 리스트 + 상태 필터 칩 + '⋮' 액션 시트.
  // KPI 카드는 칩의 건수가 대신하므로 생략(AM2 목업과 동일).
  if (isMobile) {
    const chips = [
      { code: 'ALL', label: '전체', count: stats.total },
      { code: 'RECEIVED', label: '접수', count: stats.received },
      { code: 'PROCESSING', label: '처리중', count: stats.processing },
      { code: 'RESOLVED', label: '해결', count: stats.resolved },
      { code: 'FALSE', label: '오탐', count: stats.falseCount },
    ]

    const sheetActions = (r) => [
      { label: '처리중으로 변경', tone: 'primary', disabled: r.reportStatus === 'PROCESSING' || r.isFalseReport, onClick: () => setStatus(r, 'PROCESSING') },
      { label: '해결완료로 변경', tone: 'safe', disabled: r.reportStatus === 'RESOLVED' || r.isFalseReport, onClick: () => setStatus(r, 'RESOLVED') },
      { label: r.isFalseReport ? '허위신고 처리됨' : '허위신고(오탐)로 처리', tone: 'danger', disabled: r.isFalseReport, onClick: () => markFalse(r) },
    ]

    return (
      <AdminShell user={user} onLogout={onLogout} active="reports" title="신고 관리" subtitle="긴급신고(SOS) · 원클릭 접수 건">
        {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

        <input
          style={{ ...s.searchInput, maxWidth: '100%' }}
          placeholder="신고자 / 내용 / 신고번호 검색…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* 상태 필터 칩 (가로 스크롤) */}
        <div className="ls-scroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, margin: '0 -16px', padding: '0 16px' }}>
          {chips.map(c => {
            const on = statusFilter === c.code
            return (
              <button
                key={c.code}
                onClick={() => setStatusFilter(c.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, minHeight: 34, padding: '0 13px',
                  borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  border: `1px solid ${on ? 'var(--blue-primary)' : 'var(--border)'}`,
                  background: on ? 'var(--blue-primary)' : 'var(--surface)',
                  color: on ? '#fff' : 'var(--text-muted)',
                }}
              >
                {c.label}
                <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, opacity: on ? 0.9 : 0.7 }}>{loading ? '-' : c.count}</span>
              </button>
            )
          })}
        </div>

        {/* 신고 카드 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? '불러오는 중…' : '신고 데이터가 없습니다.'}
            </div>
          )}
          {filtered.map(r => {
            const st = STATUS_STYLE[r.reportStatus] ?? { label: r.reportStatus, bg: 'var(--border)', color: 'var(--text-muted)' }
            const lv = LEVEL_STYLE[r.dangerLevel]
            return (
              <div key={r.reportId} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${st.color}`,
                borderRadius: 14, padding: '13px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, fontFamily: "'Inter',sans-serif" }}>#ER-{r.reportId}</span>
                  <span style={{ ...s.badge, backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>{fmtShort(r.reportedAt)}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, margin: '12px 0', paddingTop: 11, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', width: 66, flexShrink: 0 }}>신고자</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{r.nickname ?? '-'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', width: 66, flexShrink: 0 }}>발생좌표</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Inter',sans-serif" }}>
                      {r.latitude != null ? `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}` : '-'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', width: 66, flexShrink: 0 }}>연결 구역</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-primary)', fontFamily: "'Inter',sans-serif" }}>#{r.dangerZoneId}</span>
                    {lv && <span style={{ ...s.badge, backgroundColor: lv.bg, color: lv.color }}>{lv.label}</span>}
                  </div>
                  {r.description && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-muted)', width: 66, flexShrink: 0 }}>내용</span>
                      <span style={{ fontSize: 13, minWidth: 0, wordBreak: 'break-word' }}>{r.description}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.reportStatus === 'RECEIVED' && !r.isFalseReport && (
                    <button
                      onClick={() => setStatus(r, 'PROCESSING')}
                      style={{ minHeight: 44, padding: '0 18px', border: 'none', borderRadius: 11, background: 'var(--blue-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >처리 시작</button>
                  )}
                  {r.reportStatus === 'PROCESSING' && !r.isFalseReport && (
                    <button
                      onClick={() => setStatus(r, 'RESOLVED')}
                      style={{ minHeight: 44, padding: '0 18px', border: 'none', borderRadius: 11, background: 'var(--safe)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >해결 처리</button>
                  )}
                  <button
                    onClick={() => setSheetReport(r)}
                    title="더보기"
                    style={{
                      marginLeft: 'auto', width: 44, height: 44, borderRadius: 11, cursor: 'pointer',
                      border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {sheetReport && (
          <ActionSheet
            title={`신고 #ER-${sheetReport.reportId}`}
            subtitle={`${sheetReport.nickname ?? '-'} · ${fmtDateTime(sheetReport.reportedAt)}`}
            actions={sheetActions(sheetReport)}
            onClose={() => setSheetReport(null)}
          />
        )}
      </AdminShell>
    )
  }

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
