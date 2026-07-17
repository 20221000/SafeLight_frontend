import { useState, useEffect, useCallback } from 'react'
import AdminShell from '../components/layout/AdminShell'
import ActionSheet from '../components/layout/ActionSheet'
import { adminStyles as s, LEVEL_STYLE, STATUS_STYLE } from '../components/Admin/adminStyles'
import { apiGet, apiSend } from '../utils/adminApi'
import useIsMobile from '../hooks/useIsMobile'

const LEVELS = ['LOW', 'MEDIUM', 'HIGH']
const fmtDateTime = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '-')

// 구역 반경 미니 썸네일 (실지도 대신 반경 비율 시각화 — 목업의 미니맵 자리)
function ZoneThumb({ radius, level }) {
  const lv = LEVEL_STYLE[level] ?? LEVEL_STYLE.LOW
  const r = Math.max(10, Math.min(30, 10 + (Number(radius) || 0) / 8))
  return (
    <div style={{
      width: 72, height: 72, borderRadius: 12, flexShrink: 0, background: 'var(--bg)',
      border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill={lv.color} fillOpacity="0.12" stroke={lv.color} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="36" cy="36" r="4.5" fill={lv.color} />
      </svg>
    </div>
  )
}

export default function AdminDangerZonePage({ user, onLogout }) {
  const isMobile = useIsMobile()
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [levelSheetZone, setLevelSheetZone] = useState(null) // 모바일 '위험도 갱신' 시트 대상
  const [newCount, setNewCount] = useState(0)                // 이번 주 신규 구역 수 (렌더 중 시각 계산 금지 → 로드 시점에 계산)

  const load = useCallback(async () => {
    if (!user || user.role !== 'ADMIN') return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet('/danger-zones')
      const list = Array.isArray(data) ? data : []
      setZones(list)
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      setNewCount(list.filter(z => z.createdAt && new Date(z.createdAt).getTime() >= weekAgo).length)
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

  // 신고 내역 모달은 데스크탑/모바일 공용
  const detailModal = detail && (

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
  )

  // 모바일(AM4): 테이블 대신 구역 카드 리스트(반경 썸네일) + 위험도 갱신 시트 + 비활성화.
  // 목업의 '+ 등록'과 구역명은 넣지 않았다 — 위험구역은 긴급신고로 자동 생성되고(생성 API 없음), 이름 필드도 백엔드에 없다.
  if (isMobile) {
    const highCount = zones.filter(z => z.dangerLevel === 'HIGH').length

    return (
      <AdminShell
        user={user}
        onLogout={onLogout}
        active="dangerzones"
        title="위험 구역"
        subtitle={loading ? '불러오는 중…' : `활성 ${zones.length} · HIGH ${highCount} · 이번 주 신규 ${newCount}`}
      >
        {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {zones.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? '불러오는 중…' : '활성 위험구역이 없습니다.'}
            </div>
          )}
          {zones.map(z => {
            const lv = LEVEL_STYLE[z.dangerLevel] ?? LEVEL_STYLE.LOW
            return (
              <div key={z.dangerZoneId} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px',
              }}>
                {/* 상단(구역 요약)을 누르면 신고 내역 */}
                <button
                  onClick={() => openDetail(z)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 0,
                    border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <ZoneThumb radius={z.radius} level={z.dangerLevel} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', color: 'var(--text-strong)' }}>위험구역 #{z.dangerZoneId}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, fontFamily: "'Inter',sans-serif" }}>
                      {Number(z.centerLatitude).toFixed(4)}, {Number(z.centerLongitude).toFixed(4)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                      <span style={{ ...s.badge, backgroundColor: lv.bg, color: lv.color }}>{lv.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>반경 {z.radius ?? 0}m</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>신고 {z.reportCount ?? 0}</span>
                    </div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
                </button>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setLevelSheetZone(z)}
                    style={{
                      flex: 1, minHeight: 44, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)',
                      fontSize: 13.5, fontWeight: 700,
                    }}
                  >위험도 갱신</button>
                  <button
                    onClick={() => deactivate(z)}
                    style={{
                      flex: 1, minHeight: 44, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--danger)',
                      fontSize: 13.5, fontWeight: 700,
                    }}
                  >비활성화</button>
                </div>
              </div>
            )
          })}
        </div>

        {levelSheetZone && (
          <ActionSheet
            title={`위험구역 #${levelSheetZone.dangerZoneId} 위험도`}
            subtitle={`현재 ${LEVEL_STYLE[levelSheetZone.dangerLevel]?.label ?? levelSheetZone.dangerLevel} · 반경 ${levelSheetZone.radius ?? 0}m`}
            actions={LEVELS.map(l => ({
              label: LEVEL_STYLE[l]?.label ?? l,
              tone: l === 'HIGH' ? 'danger' : l === 'MEDIUM' ? 'default' : 'safe',
              disabled: l === levelSheetZone.dangerLevel,
              onClick: () => changeLevel(levelSheetZone, l),
            }))}
            onClose={() => setLevelSheetZone(null)}
          />
        )}
        {detailModal}
      </AdminShell>
    )
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

      {detailModal}
    </AdminShell>
  )
}
