import { useState, useEffect, useCallback } from 'react'
import AdminShell, { notifyAdminReportsChanged } from '../components/layout/AdminShell'
import ActionSheet from '../components/layout/ActionSheet'
import LocationText from '../components/LocationText'
import DangerZoneMap from '../components/DangerZoneMap'
import Icon from '../components/Icon'
import { adminStyles as s, LEVEL_STYLE, STATUS_STYLE } from '../components/Admin/adminStyles'
import { apiGet, apiSend } from '../utils/adminApi'
import useIsMobile from '../hooks/useIsMobile'

const LEVELS = ['LOW', 'MEDIUM', 'HIGH']

// 데스크탑 2열이 화면 아래까지 쓰는 최소 높이. 이보다 낮은 창에서는 셸이 스크롤한다.
const PANEL_MIN_H = 320
// 목록이 표를 온전히 담는 데 필요한 최소 폭. 지도는 '남는 폭'이 아니라 이걸 뺀 나머지를 쓴다.
// 퍼센트로 자르면 큰 모니터에서도 지도가 세로로 길어지는데(1920×1200 에서 0.7까지 갔다),
// 이렇게 두면 자리가 있는 한 정사각형을 유지하고, 좁은 창에서만 세로로 조금 길어진다.
const LIST_MIN_W = 620
const MAP_MAX_W = `calc(100% - ${LIST_MIN_W + 16}px)`
const fmtDateTime = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '-')

// 위험구역은 SOS 로 만들어질 때 expiredAt = 생성시각 + 24시간 이 박힌다.
// 목록 API 는 아직 만료되지 않은 활성 구역만 내려주므로 여기 값은 항상 '해제 예정 시각'이다.
// (관리자가 직접 비활성화하면 expiredAt 이 그 시각으로 바뀌고 목록에서 빠진다)
const remainText = (iso) => {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return '해제 대기'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}분 뒤 해제`
  const h = Math.floor(min / 60)
  return min % 60 === 0 ? `${h}시간 뒤 해제` : `${h}시간 ${min % 60}분 뒤 해제`
}
// 1시간 미만이면 곧 사라지는 구역이라 눈에 띄게 한다.
const isExpiringSoon = (iso) => {
  if (!iso) return false
  const ms = new Date(iso).getTime() - Date.now()
  return !Number.isNaN(ms) && ms > 0 && ms < 3600000
}

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
  // 지도가 비추고 있는 구역. 신고 내역 모달(detail)과는 별개다 —
  // 목록에서 구역을 고르는 것은 '지도로 보여달라'는 뜻이고, 신고 내역은 따로 연다.
  //
  // id 만 들고 있으면 같은 구역을 다시 눌렀을 때 상태가 그대로라 지도가 안 움직인다.
  // 지도를 손으로 옮겨 놓고 그 구역을 다시 눌러 되돌리는 게 안 되고, 구역이 하나뿐이면
  // 첫 클릭 뒤로 아예 반응이 없는 것처럼 보인다. 그래서 누를 때마다 seq 를 올려
  // '무엇을 골랐나'와 '몇 번째 요청인가'를 함께 넘긴다.
  const [focus, setFocus] = useState({ id: null, seq: 0 })
  const focusedId = focus.id
  const focusZone = useCallback((id) => setFocus(f => ({ id, seq: f.seq + 1 })), [])
  const [newCount, setNewCount] = useState(0)                // 이번 주 신규 구역 수 (렌더 중 시각 계산 금지 → 로드 시점에 계산)

  // silent: 주기 갱신용. '불러오는 중…' 을 띄우지 않는다 —
  // 30초마다 목록이 로딩 문구로 깜빡이면 읽고 있던 줄을 놓친다.
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!user || user.role !== 'ADMIN') return
    if (!silent) { setLoading(true); setError(null) }
    try {
      const data = await apiGet('/danger-zones')
      const list = Array.isArray(data) ? data : []
      setZones(list)
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      setNewCount(list.filter(z => z.createdAt && new Date(z.createdAt).getTime() >= weekAgo).length)
      setError(null)
    } catch (e) {
      // 주기 갱신이 한 번 실패했다고 보고 있던 목록을 에러 화면으로 바꾸지 않는다.
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // 긴급신고가 들어오면 백엔드가 위험구역을 새로 만들거나 등급·신고수를 올린다
  // (EmergencyReportService.createReport). 그런데 이 화면은 마운트 때 한 번만 읽고 있어서,
  // 관리자가 화면을 열어 둔 채로는 새 구역이 영영 안 보였다 — 신고 목록에는 뜨는데
  // 위험구역만 '활성 위험구역이 없습니다' 로 남는다. 백엔드에 푸시 수단(WebSocket·SSE)이
  // 없으므로 지도 화면(useSafetyData)과 같은 30초 주기로 조용히 다시 읽는다.
  useEffect(() => {
    const timer = setInterval(() => load({ silent: true }), 30000)
    return () => clearInterval(timer)
  }, [load])

  // 다른 탭에 갔다 돌아오면 주기를 기다리지 않고 바로 맞춘다 —
  // 돌아온 직후가 가장 낡은 화면을 보고 판단하기 쉬운 순간이다.
  useEffect(() => {
    const sync = () => { if (!document.hidden) load({ silent: true }) }
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [load])

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

  // 상세 응답(PublicDangerZoneResponse)에는 신고 목록이 없다.
  // 관리자 전용 /reports 를 따로 받아 합쳐야 모달에 신고가 나온다.
  const loadDetail = async (zoneId) => {
    const [zone, reports] = await Promise.all([
      apiGet(`/danger-zones/${zoneId}`),
      apiGet(`/danger-zones/${zoneId}/reports`),
    ])
    return { ...zone, reports: Array.isArray(reports) ? reports : [] }
  }

  const openDetail = async (zone) => {
    setDetailLoading(true)
    setDetail({ dangerZoneId: zone.dangerZoneId, reports: [], _loading: true })
    try {
      setDetail(await loadDetail(zone.dangerZoneId))
    } catch (e) {
      alert('상세 조회 실패: ' + e.message)
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshDetail = async (zoneId) => {
    try {
      setDetail(await loadDetail(zoneId))
    } catch { /* noop */ }
  }

  const setReportStatus = async (report, status) => {
    try {
      await apiSend(`/emergency-reports/${report.reportId}/status`, 'PATCH', { reportStatus: status })
      await refreshDetail(detail.dangerZoneId)
      await load()
      notifyAdminReportsChanged()
    } catch (e) {
      alert('상태 변경 실패: ' + e.message)
    }
  }

  const markFalse = async (report) => {
    if (!window.confirm(
      `신고 #${report.reportId}을(를) 허위신고로 처리할까요?\n\n`
      + '신고자의 허위신고 횟수가 1 올라가고, 누적 3회면 블랙리스트에 들어갑니다.\n'
      + '잘못 눌렀다면 같은 자리에서 취소할 수 있습니다.',
    )) return
    try {
      await apiSend(`/emergency-reports/${report.reportId}/false-report`, 'PATCH')
      await refreshDetail(detail.dangerZoneId)
      await load()
      // 사이드바 '신고 관리' 배지도 다시 세게 한다 — 이 화면에서 처리해도 숫자는 그쪽에 있다.
      notifyAdminReportsChanged()
    } catch (e) {
      alert('허위신고 처리 실패: ' + e.message)
    }
  }

  // 되돌리기는 전용 경로로만 된다. PATCH /status 로 RECEIVED 를 보내면 서버가 400 을 던진다
  // — 상태 enum 만 바꿔서는 신고자 벌점·블랙리스트가 그대로 남기 때문이다.
  const cancelFalse = async (report) => {
    if (!window.confirm(
      `신고 #${report.reportId}의 허위신고를 취소할까요?\n\n`
      + '상태가 접수됨으로 돌아가고, 신고자의 허위신고 횟수가 1 내려갑니다.\n'
      + '위험구역은 신고 후 24시간이 지났으면 다시 살아나지 않습니다.',
    )) return
    try {
      await apiSend(`/emergency-reports/${report.reportId}/false-report/cancel`, 'PATCH')
      await refreshDetail(detail.dangerZoneId)
      await load()
      notifyAdminReportsChanged()
    } catch (e) {
      alert('허위신고 취소 실패: ' + e.message)
    }
  }

  // 인라인 스타일에는 :disabled 가 없다. 회색 처리를 직접 주지 않으면 못 누르는 버튼이 멀쩡해 보인다.
  const dim = (base, off) => (off ? { ...base, opacity: 0.45, cursor: 'default' } : base)

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
                {detail.expiredAt && (
                  <span>자동 해제: {fmtDateTime(detail.expiredAt)}
                    <b style={{ marginLeft: 5, color: isExpiringSoon(detail.expiredAt) ? 'var(--warning)' : 'var(--text-muted)' }}>
                      ({remainText(detail.expiredAt)})
                    </b>
                  </span>
                )}
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
                    {/* 예전엔 '위도 37.5..., 경도 127.0...' 이라 어디인지 알 수 없었다.
                        주소를 앞세우고 좌표는 옆에 작게 남긴다. 신고 관리 표와 같은 규칙이다. */}
                    <div style={{ marginBottom: '8px' }}>
                      <LocationText lat={r.latitude} lng={r.longitude} addressSize={12} coordSize={11} />
                      {r.nearestCctv && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: 7 }}>
                          · 인근 CCTV: {r.nearestCctv.cctvName ?? r.nearestCctv.cctvId}
                        </span>
                      )}
                    </div>
                    {/* 허위신고로 확정된 건은 상태 두 개가 잠긴다 — 서버가 PATCH /status 를 400 으로 막는다.
                        먼저 무엇을 해야 풀리는지 title 로 알려주고, 세 번째 버튼을 '취소'로 뒤집는다. */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        style={dim(s.btnOrange, r.reportStatus === 'RECEIVED' || r.isFalseReport)}
                        onClick={() => setReportStatus(r, 'RECEIVED')}
                        disabled={r.reportStatus === 'RECEIVED' || r.isFalseReport}
                        title={r.isFalseReport ? '허위신고를 먼저 취소해주세요.' : undefined}
                      >접수됨</button>
                      <button
                        style={dim(s.btnMint, r.reportStatus === 'RESOLVED' || r.isFalseReport)}
                        onClick={() => setReportStatus(r, 'RESOLVED')}
                        disabled={r.reportStatus === 'RESOLVED' || r.isFalseReport}
                        title={r.isFalseReport ? '허위신고를 먼저 취소해주세요.' : undefined}
                      >해결완료</button>
                      {r.isFalseReport ? (
                        <button style={s.btnGray} onClick={() => cancelFalse(r)}>허위신고 취소</button>
                      ) : (
                        <button style={s.btnRed} onClick={() => markFalse(r)}>허위신고 처리</button>
                      )}
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

        {/* 지도는 위에 붙박이로 두고 목록만 흘러간다 — 카드를 훑는 내내 지도가 보여야
            "지금 고른 구역이 어디였지"를 다시 확인하러 올라올 일이 없다.
            셸의 본문(main.ls-scroll)이 스크롤 컨테이너라 sticky 가 그 기준으로 붙는다.
            좌우·상단 음수 마진은 본문 패딩까지 덮어, 밑으로 지나가는 카드가 비치지 않게 한다. */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 4,
          margin: '-16px -16px 0', padding: '16px 16px 12px',
          background: 'var(--bg)',
        }}>
          <DangerZoneMap
            zones={zones}
            height={220}
            selectedId={focusedId}
            focusSeq={focus.seq}
            onSelect={z => focusZone(z.dangerZoneId)}
            emptyText={loading ? '불러오는 중…' : '활성 위험구역이 없습니다.'}
          />
        </div>

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
                background: 'var(--surface)', borderRadius: 14, padding: '13px 14px',
                // 지금 지도가 비추고 있는 구역을 카드에서도 알아볼 수 있게 한다.
                border: `1px solid ${focusedId === z.dangerZoneId ? 'var(--blue-primary)' : 'var(--border)'}`,
              }}>
                {/* 상단(구역 요약)을 누르면 위 지도가 이 구역으로 이동한다.
                    신고 내역은 아래 버튼으로 따로 연다 — 모달이 뜨면 지도가 가려진다. */}
                <button
                  onClick={() => focusZone(z.dangerZoneId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 0,
                    border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <ZoneThumb radius={z.radius} level={z.dangerLevel} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', color: 'var(--text-strong)' }}>위험구역 #{z.dangerZoneId}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, fontFamily: "'Inter',sans-serif" }}>
                      {Number(z.centerLatitude).toFixed(3)}, {Number(z.centerLongitude).toFixed(3)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                      <span style={{ ...s.badge, backgroundColor: lv.bg, color: lv.color }}>{lv.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>반경 {z.radius ?? 0}m</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>신고 {z.reportCount ?? 0}</span>
                      {/* 자동 해제까지 남은 시간 — 24시간이 지나면 목록에서 사라진다. */}
                      {remainText(z.expiredAt) && (
                        <span style={{
                          fontSize: 11.5, fontWeight: 700,
                          color: isExpiringSoon(z.expiredAt) ? 'var(--warning)' : 'var(--text-muted)',
                        }}>{remainText(z.expiredAt)}</span>
                      )}
                    </div>
                  </div>
                  {/* 화살표(>)는 '다음 화면으로'로 읽힌다. 이 버튼이 하는 일은 지도 이동이라 핀으로 바꾼다. */}
                  <Icon
                    name="map-pin"
                    size={18}
                    color={focusedId === z.dangerZoneId ? 'var(--blue-primary)' : 'var(--text-muted)'}
                  />
                </button>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => openDetail(z)}
                    style={{
                      flex: 1, minHeight: 44, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)',
                      fontSize: 13.5, fontWeight: 700,
                    }}
                  >신고 내역</button>
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

      {/* 좌: 정사각형 지도 / 우: 목록.
          예전엔 지도가 위, 표가 아래라 구역이 몇 개 없으면 화면 아래가 통째로 비었고
          많으면 표를 보려고 지도를 스크롤 밖으로 밀어내야 했다. 나란히 두면 둘 다 안 생긴다.
          바깥(main)이 아니라 목록만 스크롤한다 — 지도는 늘 제자리에 있다. */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: PANEL_MIN_H }}>
        {/* 정사각형 — 높이를 다 쓰고(height:100%) aspect-ratio 가 그만큼의 폭을 만든다.
            화면이 커져도 아래가 남지 않는다. 다만 세로로 긴 창에서는 maxWidth 에 먼저 걸려
            폭만 멈추고 높이는 계속 늘어나므로, 정사각형에서 세로로 조금 긴 형태까지만 변한다. */}
        <div style={{
          height: '100%', aspectRatio: '1 / 1', maxWidth: MAP_MAX_W, minWidth: 280, flexShrink: 0,
        }}>
          <DangerZoneMap
            zones={zones}
            height="100%"
            selectedId={focusedId}
            focusSeq={focus.seq}
            onSelect={z => focusZone(z.dangerZoneId)}
            emptyText={loading ? '불러오는 중…' : '활성 위험구역이 없습니다.'}
          />
        </div>

        <div style={{
          ...s.card, padding: 0, flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            padding: '14px 18px', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>위험구역 목록</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              활성 <b style={{ color: 'var(--text-strong)', fontWeight: 800, fontFamily: "'Inter',sans-serif" }}>{zones.length}</b>개
            </span>
          </div>

          {/* 세로는 목록이 길 때, 가로는 창이 좁아 열이 뭉개질 때를 위한 안전판이다. */}
          <div className="ls-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ ...s.table, minWidth: 520 }}>
              <thead>
                {/* 스크롤해도 열 이름은 남아 있어야 어느 칸인지 알 수 있다. */}
                {/* '생성일'은 뺐다 — 자동 해제 = 생성 + 24시간이라 같은 정보가 두 번 들어간다.
                    좁은 창에서 열이 밀려 가로 스크롤이 생기던 원인이기도 했다. */}
                <tr>{['ID', '중심 좌표', '반경', '위험도', '신고수', '자동 해제', '관리'].map(h => (
                  <th key={h} style={{ ...s.th, position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
            {zones.length > 0 ? zones.map(z => (
              // 행을 누르면 위 지도가 이 구역으로 이동한다. 위험도 select 와 관리 버튼이 든
              // 칸은 아래에서 전파를 끊는다 — 그것들은 지도 이동이 아니라 각자의 일을 한다.
              <tr
                key={z.dangerZoneId}
                onClick={() => focusZone(z.dangerZoneId)}
                title="지도에서 보기"
                style={{
                  ...s.tr,
                  cursor: 'pointer',
                  background: focusedId === z.dangerZoneId ? 'var(--blue-tint)' : undefined,
                }}
              >
                <td style={{ ...s.td, fontWeight: focusedId === z.dangerZoneId ? 800 : undefined }}>
                  #{z.dangerZoneId}
                </td>
                {/* 구역 중심 좌표는 백엔드가 소수 3자리로 반올림해 내려준다 */}
                <td style={s.td}>{Number(z.centerLatitude).toFixed(3)}, {Number(z.centerLongitude).toFixed(3)}</td>
                <td style={s.td}>{z.radius}m</td>
                <td style={s.td} onClick={e => e.stopPropagation()}>
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
                {/* 생성 24시간 뒤 자동 해제 — 시각과 남은 시간을 같이 보여준다. */}
                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                  {z.expiredAt ? (
                    <>
                      <div>{fmtDateTime(z.expiredAt)}</div>
                      <div style={{
                        fontSize: 11.5, fontWeight: 700, marginTop: 2,
                        color: isExpiringSoon(z.expiredAt) ? 'var(--warning)' : 'var(--text-muted)',
                      }}>{remainText(z.expiredAt)}</div>
                    </>
                  ) : '-'}
                </td>
                {/* 목록 패널이 화면 절반뿐이라 관리 열이 가장 먼저 넘친다. 여백만 줄여 담는다. */}
                <td style={s.td} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={{ ...s.btnMint, padding: '7px 10px' }} onClick={() => openDetail(z)}>신고 보기</button>
                    <button style={{ ...s.btnRed, padding: '7px 10px' }} onClick={() => deactivate(z)}>비활성화</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} style={s.emptyRow}>{loading ? '불러오는 중…' : '활성 위험구역이 없습니다.'}</td></tr>
            )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detailModal}
    </AdminShell>
  )
}
