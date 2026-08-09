import { useState, useEffect, useCallback, useMemo } from 'react'
import AdminShell, { notifyAdminReportsChanged } from '../components/layout/AdminShell'
import ActionSheet from '../components/layout/ActionSheet'
import ConfirmDialog from '../components/layout/ConfirmDialog'
import RowMenu from '../components/Admin/RowMenu'
import { adminStyles as s, LEVEL_STYLE, STATUS_STYLE } from '../components/Admin/adminStyles'
import { apiSend } from '../utils/adminApi'
import { fetchReportPage, fetchReportStats } from '../utils/reportsAggregate'
import useIsMobile from '../hooks/useIsMobile'
import Icon from '../components/Icon'

const fmtDateTime = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '-')
// 모바일 카드는 공간이 좁아 날짜 대신 'MM-DD HH:mm'
const fmtShort = (iso) => (iso ? String(iso).slice(5, 16).replace('T', ' ') : '-')

// 한 번에 받아올 행 수. 예전에는 전체(최대 5,000행)를 받아 놓고 걸렀다.
const PAGE_SIZE = 20

// 상태 필터 옵션 (label ↔ 백엔드 코드)
// 백엔드 EmergencyReportStatus 는 RECEIVED/RESOLVED/FALSE 3개뿐이다.
// 필터 컨트롤 앞 라벨 — '기간', '상태'
const filterLabel = { fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }

const STATUS_OPTIONS = [
  { code: 'ALL',        label: '전체 상태' },
  { code: 'RECEIVED',   label: '접수됨' },
  { code: 'RESOLVED',   label: '해결완료' },
  { code: 'FALSE',      label: '허위신고' },
]

export default function AdminReportPage({ user, onLogout }) {
  const isMobile = useIsMobile()
  const [reports, setReports] = useState([])
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 0, totalElements: 0, last: true })
  const [stats, setStats] = useState({ total: 0, received: 0, resolved: 0, falseCount: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')          // 입력 중인 값
  const [searchTerm, setSearchTerm] = useState('')  // 디바운스로 확정된 검색어
  const [sheetReport, setSheetReport] = useState(null) // 모바일 '⋮' 액션 시트 대상
  const [confirmFalse, setConfirmFalse] = useState(null) // 허위신고 확정 대상 (되돌릴 수 없어 한 번 더 묻는다)

  // 기간을 거꾸로 넣으면 백엔드가 400을 던지므로 미리 막는다.
  const invalidRange = Boolean(startDate && endDate && startDate > endDate)

  // 검색어도 서버 필터의 일부다(2026-08-09 백엔드에 keyword 추가).
  // 예전엔 파라미터가 없어서 검색할 때만 전체를 긁어와 자바스크립트로 걸렀는데,
  // 그러면 한 페이지 안에서만 맞는 결과라 건수도 페이지네이션도 어긋났다.
  const filters = useMemo(
    () => ({ statusFilter, startDate, endDate, keyword: searchTerm }),
    [statusFilter, startDate, endDate, searchTerm],
  )

  // 타이핑 한 글자마다 서버를 때리지 않도록 검색어만 디바운스한다.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // append 는 모바일 '더 보기' 전용 — 데스크탑은 페이지를 통째로 갈아 끼운다.
  const load = useCallback(async (page = 0, { append = false } = {}) => {
    if (!user || user.role !== 'ADMIN' || invalidRange) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchReportPage(filters, page, PAGE_SIZE)
      setReports(prev => (append ? [...prev, ...res.reports] : res.reports))
      setPageInfo({ page: res.page, totalPages: res.totalPages, totalElements: res.totalElements, last: res.last })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, filters, invalidRange])

  // KPI 는 목록과 따로 센다. size=1 요청 4번이라 페이지를 넘겨도 숫자가 흔들리지 않는다.
  const loadStats = useCallback(async () => {
    if (!user || user.role !== 'ADMIN' || invalidRange) return
    try {
      setStats(await fetchReportStats({ startDate, endDate }))
    } catch {
      // 집계 실패가 목록까지 막을 이유는 없다.
    }
  }, [user, startDate, endDate, invalidRange])

  // 필터나 검색어가 바뀌면 언제나 첫 페이지부터 다시 받는다.
  useEffect(() => { load(0) }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  // 상태 필터의 서버 조건과 같은 판정 — 필터에서 벗어난 행은 목록에서 빼기 위해 쓴다.
  const matchesStatusFilter = useCallback((r) => {
    if (statusFilter === 'ALL') return true
    if (statusFilter === 'FALSE') return Boolean(r.isFalseReport)
    return r.reportStatus === statusFilter
  }, [statusFilter])

  // PATCH 응답이 갱신된 신고 한 건이라 목록을 다시 받지 않고 그 행만 교체한다
  // (다시 받으면 데스크탑에서 보고 있던 페이지 위치를 잃는다).
  const applyUpdated = useCallback((reportId, updated) => {
    if (!updated) { load(pageInfo.page); return }
    setReports(prev => prev.flatMap(r => {
      if (r.reportId !== reportId) return [r]
      const next = { ...r, ...updated }
      return matchesStatusFilter(next) ? [next] : []
    }))
    loadStats()
    // 사이드바 '신고 관리' 배지도 다시 세게 한다. 허위신고로 처리하면 서버에서 그 건이 빠지는데
    // 배지는 화면을 새로 열기 전까지 옛 숫자를 들고 있었다.
    notifyAdminReportsChanged()
  }, [load, loadStats, matchesStatusFilter, pageInfo.page])

  const setStatus = async (report, status) => {
    try {
      const updated = await apiSend(`/emergency-reports/${report.reportId}/status`, 'PATCH', { reportStatus: status })
      applyUpdated(report.reportId, updated)
    } catch (e) {
      alert('상태 변경 실패: ' + e.message)
    }
  }

  // 허위신고는 서버에 되돌리는 경로가 없다(PATCH /status 는 enum 만 바꿀 뿐 isFalseReport·
  // 신고자 벌점·위험구역을 그대로 둬서, 눌러봐야 앞뒤가 안 맞는 기록만 남는다).
  // 그래서 누르기 전에 못 되돌린다는 걸 분명히 알린다 — 겪고 나서 알게 두지 않는다.
  const markFalse = (report) => setConfirmFalse(report)

  const runMarkFalse = async (report) => {
    setConfirmFalse(null)
    try {
      const updated = await apiSend(`/emergency-reports/${report.reportId}/false-report`, 'PATCH')
      applyUpdated(report.reportId, updated)
    } catch (e) {
      alert('허위신고 처리 실패: ' + e.message)
    }
  }

  const resetFilters = () => {
    setStatusFilter('ALL'); setStartDate(''); setEndDate(''); setSearch(''); setSearchTerm('')
  }
  const hasFilter = Boolean(statusFilter !== 'ALL' || startDate || endDate || search)

  // 상태·기간·키워드 모두 서버가 걸러 보낸다. 화면에서 따로 거르지 않는다.
  const shownCount = pageInfo.totalElements

  const emptyText = loading
    ? '불러오는 중…'
    : hasFilter ? '조건에 맞는 신고가 없습니다.' : '신고 데이터가 없습니다.'

  const kpiCards = [
    { key: 'total',      icon: 'siren',        label: '전체 신고', value: stats.total,      color: '#2563EB' },
    { key: 'received',   icon: 'inbox',        label: '접수됨',    value: stats.received,   color: '#E11D48' },
    { key: 'resolved',   icon: 'check-circle', label: '해결완료',  value: stats.resolved,   color: '#10B981' },
    { key: 'falseCount', icon: 'ban',          label: '허위신고',  value: stats.falseCount, color: '#64748B' },
  ]

  // 기간 필터 — 값은 startDate/endDate 파라미터로 그대로 서버에 넘어간다.
  // 데스크탑·모바일이 같은 마크업을 쓰고, 폭만 부모가 정한다.
  const dateRange = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 250px', maxWidth: 320 }}>
      <input
        type="date" value={startDate} max={endDate || undefined}
        onChange={e => setStartDate(e.target.value)}
        style={{ ...s.input, flex: 1, minWidth: 0, padding: '10px 11px', cursor: 'pointer' }}
      />
      <span style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>~</span>
      <input
        type="date" value={endDate} min={startDate || undefined}
        onChange={e => setEndDate(e.target.value)}
        style={{ ...s.input, flex: 1, minWidth: 0, padding: '10px 11px', cursor: 'pointer' }}
      />
    </div>
  )

  const rangeWarning = invalidRange && (
    <div style={{ ...s.errorBox }}>시작일이 종료일보다 늦습니다. 기간을 다시 골라주세요.</div>
  )

  // 모바일(AM2): 데스크탑 테이블 대신 카드 리스트 + 상태 필터 칩 + '⋮' 액션 시트.
  // KPI 카드는 칩의 건수가 대신하므로 생략(AM2 목업과 동일).
  if (isMobile) {
    const chips = [
      { code: 'ALL', label: '전체', count: stats.total },
      { code: 'RECEIVED', label: '접수', count: stats.received },
      { code: 'RESOLVED', label: '해결', count: stats.resolved },
      { code: 'FALSE', label: '오탐', count: stats.falseCount },
    ]

    // 허위신고로 확정된 건은 나머지 두 개도 잠긴다 — 서버가 되돌려주지 않아 눌러도 앞뒤가 안 맞는다.
    // 왜 잠겼는지 라벨에 적어 둔다(그냥 회색이면 고장으로 읽힌다).
    const sheetActions = (r) => [
      { label: r.isFalseReport ? '접수됨으로 되돌리기 (허위신고 확정 건은 불가)' : '접수됨으로 되돌리기', tone: 'primary', disabled: r.reportStatus === 'RECEIVED' || r.isFalseReport, onClick: () => setStatus(r, 'RECEIVED') },
      { label: '해결완료로 변경', tone: 'safe', disabled: r.reportStatus === 'RESOLVED' || r.isFalseReport, onClick: () => setStatus(r, 'RESOLVED') },
      { label: r.isFalseReport ? '허위신고 처리됨 (되돌릴 수 없음)' : '허위신고(오탐)로 처리', tone: 'danger', disabled: r.isFalseReport, onClick: () => markFalse(r) },
    ]

    return (
      <AdminShell user={user} onLogout={onLogout} active="reports" title="신고 관리" subtitle="긴급신고(SOS) · 원클릭 접수 건">
        {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

        {rangeWarning}

        <input
          style={{ ...s.searchInput, maxWidth: '100%' }}
          placeholder="신고자 닉네임 · 아이디 / 신고 내용 검색…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* 기간 필터 + 초기화 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dateRange}
          {hasFilter && (
            <button onClick={resetFilters} style={{ ...s.btnGray, minHeight: 40, padding: '0 13px', flexShrink: 0 }}>초기화</button>
          )}
        </div>

        {/* 상태 필터 칩 — 안 들어가면 다음 줄로 내린다. 가로 스크롤은 쓰지 않는다
            (스크롤바가 없으면 화면 밖 칩을 발견할 방법이 없다). */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
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
          {reports.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {emptyText}
            </div>
          )}
          {reports.map(r => {
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

        {/* 더 보기 — 카드 리스트라 페이지 번호보다 이어 붙이는 쪽이 맞다.
            검색 결과도 서버가 페이지로 나눠 주므로 검색 중에도 그대로 쓴다. */}
        {!pageInfo.last && (
          <button
            onClick={() => load(pageInfo.page + 1, { append: true })}
            disabled={loading}
            style={{
              minHeight: 46, borderRadius: 12, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-strong)', fontSize: 13.5, fontWeight: 700,
            }}
          >{loading ? '불러오는 중…' : `더 보기 (${reports.length} / ${shownCount})`}</button>
        )}

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {searchTerm
            ? `'${searchTerm}' 검색 결과 ${reports.length} / ${shownCount}건`
            : `${reports.length} / ${shownCount}건`}
        </div>

        {sheetReport && (
          <ActionSheet
            title={`신고 #ER-${sheetReport.reportId}`}
            subtitle={`${sheetReport.nickname ?? '-'} · ${fmtDateTime(sheetReport.reportedAt)}`}
            actions={sheetActions(sheetReport)}
            onClose={() => setSheetReport(null)}
          />
        )}

        <ConfirmDialog
          open={!!confirmFalse}
          danger
          title={`신고 #ER-${confirmFalse?.reportId} 을(를) 허위신고로 확정합니다`}
          message={'되돌릴 수 없습니다. 신고자의 허위신고 횟수가 1 올라가고, 누적 3회가 되면 자동으로 블랙리스트에 들어갑니다. 이 신고로 잡혀 있던 위험구역도 다시 계산됩니다.'}
          confirmLabel="허위신고로 확정"
          cancelLabel="취소"
          onConfirm={() => runMarkFalse(confirmFalse)}
          onCancel={() => setConfirmFalse(null)}
        />
      </AdminShell>
    )
  }

  // 데스크탑 '관리' 열 드롭다운 항목. 상태를 고르는 메뉴이므로 라벨은 상태 이름 그대로 두고
  // 지금 상태에 체크를 준다(모바일 시트는 버튼 하나짜리라 '…로 변경' 서술형 라벨을 유지한다).
  // 허위신고는 되돌릴 수 없고 신고자에게 벌점까지 붙으므로 설명을 달아 둔다 —
  // 예전 빨간 버튼은 아무 경고 없이 확인창부터 띄웠다.
  const desktopActions = (r) => [
    {
      label: '접수됨',
      tone: 'primary',
      selected: r.reportStatus === 'RECEIVED' && !r.isFalseReport,
      disabled: r.isFalseReport || r.reportStatus === 'RECEIVED',
      // 왜 못 누르는지 적어 준다 — 회색으로만 두면 화면이 고장 난 걸로 읽힌다.
      caption: r.isFalseReport ? '허위신고로 확정된 건은 상태를 되돌릴 수 없습니다' : undefined,
      onClick: () => setStatus(r, 'RECEIVED'),
    },
    {
      label: '해결완료',
      tone: 'safe',
      selected: r.reportStatus === 'RESOLVED',
      disabled: r.isFalseReport || r.reportStatus === 'RESOLVED',
      onClick: () => setStatus(r, 'RESOLVED'),
    },
    {
      label: '허위신고',
      tone: 'danger',
      selected: r.isFalseReport,
      disabled: r.isFalseReport,
      caption: r.isFalseReport
        ? '이미 확정됨 · 되돌릴 수 없습니다'
        : '되돌릴 수 없음 · 신고자 허위신고 +1 · 누적 3회면 블랙리스트',
      onClick: () => markFalse(r),
    },
  ]

  return (
    <AdminShell user={user} onLogout={onLogout} active="reports" title="신고 관리" subtitle="원클릭 긴급신고 접수·처리 현황">
      {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {kpiCards.map(item => (
          <div key={item.key} style={s.kpiCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ ...s.kpiIcon, backgroundColor: item.color + '22' }}>
                <Icon name={item.icon} size={22} color={item.color} strokeWidth={2} />
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

      {rangeWarning}

      {/* 필터 — 상태·기간은 서버가 거른다. 검색어만 백엔드에 파라미터가 없어 아래에서 건다. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <input
          style={s.searchInput}
          placeholder="신고자 닉네임 · 아이디 / 신고 내용 검색…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {/* 라벨 없는 날짜칸 두 개는 '무엇의 기간'인지 읽히지 않는다. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={filterLabel}>기간</span>
          {dateRange}
          <span style={{ ...filterLabel, marginLeft: 4 }}>상태</span>
          <select
            style={{ ...s.input, width: 'auto', cursor: 'pointer' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
          {hasFilter && <button onClick={resetFilters} style={s.btnGray}>초기화</button>}
        </div>
      </div>

      {/* 신고 테이블 — 총 건수와 페이저를 카드 안에 둔다.
          밖에 두면 건수는 필터의 일부처럼, 페이저는 표와 무관한 것처럼 읽힌다. */}
      <div style={s.card}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 4px 12px', borderBottom: '1px solid var(--border)', marginBottom: 4,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>신고 목록</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {searchTerm ? '검색 결과 ' : '총 '}
            <b style={{ color: 'var(--text-strong)', fontWeight: 800, fontFamily: "'Inter',sans-serif" }}>{shownCount.toLocaleString()}</b>건
          </span>
        </div>
        <table style={s.table}>
          <thead>
            <tr>{['신고번호', '신고자', '상태', '위험구역', '위험도', '좌표', '내용', '발생시각', '관리']
              .map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {reports.length > 0 ? reports.map(r => (
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
                {/* 버튼 3개를 늘어놓으면 행마다 색이 셋씩 튀어 표가 시끄럽고, 무엇보다
                    인라인 스타일에는 :disabled 가 없어 못 누르는 버튼이 멀쩡해 보였다.
                    드롭다운으로 접고 현재 상태에 체크를 준다. (모바일은 ActionSheet 유지) */}
                <td style={s.td}>
                  <RowMenu
                    label="상태 변경"
                    disabled={r.isFalseReport}
                    title={r.isFalseReport ? '허위신고로 확정된 건은 상태를 바꿀 수 없습니다.' : undefined}
                    actions={desktopActions(r)}
                  />
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9} style={s.emptyRow}>{emptyText}</td></tr>
            )}
          </tbody>
        </table>

        {/* 페이지네이션 — 검색 중에는 이미 전체를 받아 온 뒤라 감춘다. */}
        {!searchTerm && pageInfo.totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '14px 4px 2px', borderTop: '1px solid var(--border)',
        }}>
          <button
            style={{ ...s.btnGray, opacity: pageInfo.page === 0 || loading ? 0.5 : 1 }}
            disabled={pageInfo.page === 0 || loading}
            onClick={() => load(pageInfo.page - 1)}
          >← 이전</button>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: "'Inter',sans-serif" }}>
            {pageInfo.page + 1} / {pageInfo.totalPages}
          </span>
          <button
            style={{ ...s.btnGray, opacity: pageInfo.last || loading ? 0.5 : 1 }}
            disabled={pageInfo.last || loading}
            onClick={() => load(pageInfo.page + 1)}
          >다음 →</button>
        </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmFalse}
        danger
        title={`신고 #ER-${confirmFalse?.reportId} 을(를) 허위신고로 확정합니다`}
        message={'되돌릴 수 없습니다. 신고자의 허위신고 횟수가 1 올라가고, 누적 3회가 되면 자동으로 블랙리스트에 들어갑니다. 이 신고로 잡혀 있던 위험구역도 다시 계산됩니다.'}
        confirmLabel="허위신고로 확정"
        cancelLabel="취소"
        onConfirm={() => runMarkFalse(confirmFalse)}
        onCancel={() => setConfirmFalse(null)}
      />
    </AdminShell>
  )
}
