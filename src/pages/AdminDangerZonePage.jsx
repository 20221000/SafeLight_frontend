import { useState, useEffect, useCallback } from 'react'
import AdminShell from '../components/layout/AdminShell'
import { adminStyles as s, LEVEL_STYLE, STATUS_STYLE } from '../components/Admin/adminStyles'
import { apiGet, apiSend } from '../utils/adminApi'

const LEVELS = ['LOW', 'MEDIUM', 'HIGH']
const fmtDateTime = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '-')

export default function AdminDangerZonePage({ user, onLogout }) {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user || user.role !== 'ADMIN') return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet('/danger-zones')
      setZones(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const changeLevel = async (zone, level) => {
    if (level === zone.dangerLevel) return
    try {
      await apiSend(`/danger-zones/${zone.dangerZoneId}/level`, 'PATCH', { dangerLevel: level })
      await load()
    } catch (e) {
      alert('위험도 변경 실패: ' + e.message)
    }
  }

  const deactivate = async (zone) => {
    if (!window.confirm(`위험구역 #${zone.dangerZoneId}을(를) 비활성화할까요?`)) return
    try {
      await apiSend(`/danger-zones/${zone.dangerZoneId}/deactivate`, 'PATCH')
      await load()
    } catch (e) {
      alert('비활성화 실패: ' + e.message)
    }
  }

  const openDetail = async (zone) => {
    setDetailLoading(true)
    setDetail({ dangerZoneId: zone.dangerZoneId, reports: [], _loading: true })
    try {
      const data = await apiGet(`/danger-zones/${zone.dangerZoneId}`)
      setDetail(data)
    } catch (e) {
      alert('상세 조회 실패: ' + e.message)
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshDetail = async (zoneId) => {
    try {
      const data = await apiGet(`/danger-zones/${zoneId}`)
      setDetail(data)
    } catch { /* noop */ }
  }

  const setReportStatus = async (report, status) => {
    try {
      await apiSend(`/emergency-reports/${report.reportId}/status`, 'PATCH', { reportStatus: status })
      await refreshDetail(detail.dangerZoneId)
      await load()
    } catch (e) {
      alert('상태 변경 실패: ' + e.message)
    }
  }

  const markFalse = async (report) => {
    if (!window.confirm(`신고 #${report.reportId}을(를) 허위신고로 처리할까요?`)) return
    try {
      await apiSend(`/emergency-reports/${report.reportId}/false-report`, 'PATCH')
      await refreshDetail(detail.dangerZoneId)
      await load()
    } catch (e) {
      alert('허위신고 처리 실패: ' + e.message)
    }
  }

  return (
    <AdminShell user={user} onLogout={onLogout} active="dangerzones" title="위험 구역" subtitle="긴급신고로 생성된 위험 구역을 관리합니다">
      {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>활성 위험구역 {zones.length}개</div>

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>{['ID', '중심 좌표', '반경', '위험도', '신고수', '생성일', '관리'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {zones.length > 0 ? zones.map(z => (
              <tr key={z.dangerZoneId} style={s.tr}>
                <td style={s.td}>#{z.dangerZoneId}</td>
                <td style={s.td}>{Number(z.centerLatitude).toFixed(5)}, {Number(z.centerLongitude).toFixed(5)}</td>
                <td style={s.td}>{z.radius}m</td>
                <td style={s.td}>
                  <select
                    value={z.dangerLevel}
                    onChange={e => changeLevel(z, e.target.value)}
                    style={{
                      ...s.badge,
                      backgroundColor: LEVEL_STYLE[z.dangerLevel]?.bg ?? '#4A5568',
                      color: LEVEL_STYLE[z.dangerLevel]?.color ?? '#fff',
                      border: 'none', cursor: 'pointer', padding: '4px 8px',
                    }}
                  >
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </td>
                <td style={s.td}>{z.reportCount ?? 0}건</td>
                <td style={s.td}>{fmtDateTime(z.createdAt)}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={s.btnMint} onClick={() => openDetail(z)}>신고 보기</button>
                    <button style={s.btnRed} onClick={() => deactivate(z)}>비활성화</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} style={s.emptyRow}>{loading ? '불러오는 중…' : '활성 위험구역이 없습니다.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div style={s.modalOverlay} onClick={() => setDetail(null)}>
          <div style={{ ...s.modal, width: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>위험구역 #{detail.dangerZoneId} · 신고 내역</div>

            {!detail._loading && (
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                <span>위험도: <b style={{ color: LEVEL_STYLE[detail.dangerLevel]?.color }}>{detail.dangerLevel}</b></span>
                <span>반경: {detail.radius}m</span>
                <span>신고수: {detail.reportCount ?? 0}건</span>
                <span>중심: {detail.centerLatitude}, {detail.centerLongitude}</span>
              </div>
            )}

            {detailLoading || detail._loading ? (
              <div style={s.loading}>신고 내역 불러오는 중…</div>
            ) : (detail.reports?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {detail.reports.map(r => (
                  <div key={r.reportId} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-strong)', fontWeight: '700', fontSize: '13px', fontFamily: "'Inter',sans-serif" }}>#ER-{r.reportId}</span>
                      <span style={{ ...s.badge, background: STATUS_STYLE[r.reportStatus]?.bg ?? 'var(--bg)', color: STATUS_STYLE[r.reportStatus]?.color ?? 'var(--text-muted)' }}>
                        {STATUS_STYLE[r.reportStatus]?.label ?? r.reportStatus}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', flex: 1 }}>{r.nickname}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{fmtDateTime(r.reportedAt)}</span>
                    </div>
                    {r.description && <div style={{ color: 'var(--text-strong)', fontSize: '12px', marginBottom: '4px' }}>{r.description}</div>}
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>
                      위도 {r.latitude}, 경도 {r.longitude}
                      {r.nearestCctv ? ` · 인근 CCTV: ${r.nearestCctv.cctvName ?? r.nearestCctv.cctvId}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={s.btnOrange} onClick={() => setReportStatus(r, 'PROCESSING')}>처리중</button>
                      <button style={s.btnMint} onClick={() => setReportStatus(r, 'RESOLVED')}>해결완료</button>
                      <button style={s.btnRed} onClick={() => markFalse(r)} disabled={r.isFalseReport}>
                        {r.isFalseReport ? '허위신고됨' : '허위신고 처리'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={s.emptyRow}>이 구역에 접수된 신고가 없습니다.</div>
            ))}

            <div style={s.modalActions}>
              <button style={s.btnGray} onClick={() => setDetail(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
