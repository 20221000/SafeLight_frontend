// 관리자 신고 조회 공용 유틸
// GET /admin/emergency-reports 는 status / isFalseReport / dangerZoneId / reporterId /
// keyword / startDate / endDate 를 서버에서 걸러준다. 예전에는 이 파라미터를 하나도 안 쓰고
// 전체를 긁어와 자바스크립트로 걸렀던 탓에 신고가 쌓일수록 관리자 화면이 느려졌다.
import { apiGet } from './adminApi'

// <input type="date"> 는 '2026-08-06' 을 주지만 백엔드는 ISO_DATE_TIME 을 요구한다.
// 종료일은 그 날 하루를 통째로 포함해야 하므로 23:59:59 로 맞춘다.
const startOfDay = (d) => (d ? `${d}T00:00:00` : null)
const endOfDay = (d) => (d ? `${d}T23:59:59` : null)

// 상태 필터 코드 → 서버 파라미터.
// 'FALSE' 는 status 대신 isFalseReport 로 보낸다. markFalseReport 가 status 와 플래그를
// 함께 세우는 반면 status 만 FALSE 로 바꾸는 경로도 있어, '허위 판정됨'의 근거는 플래그 쪽이다.
function statusParams(statusFilter) {
  if (!statusFilter || statusFilter === 'ALL') return {}
  if (statusFilter === 'FALSE') return { isFalseReport: true }
  return { status: statusFilter }
}

// 필터 객체 → 쿼리스트링. 빈 값은 아예 보내지 않는다(백엔드가 null 을 '조건 없음'으로 본다).
function buildQuery(filters = {}, page = 0, size = 20) {
  const { statusFilter, startDate, endDate, dangerZoneId, reporterId, keyword } = filters
  const params = {
    page,
    size,
    ...statusParams(statusFilter),
    dangerZoneId: dangerZoneId ?? null,
    reporterId: reporterId ?? null,
    // 서버가 신고 내용(description)·신고자 닉네임·신고자 아이디를 대소문자 무시하고 LIKE 로 훑는다.
    keyword: keyword || null,
    startDate: startOfDay(startDate),
    endDate: endOfDay(endDate),
  }

  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') qs.append(k, String(v))
  })
  return qs.toString()
}

// 한 페이지만 가져온다. 목록 화면의 기본 경로.
// { reports, page, size, totalElements, totalPages, first, last } 를 그대로 돌려준다.
export async function fetchReportPage(filters = {}, page = 0, size = 20) {
  const res = await apiGet(`/admin/emergency-reports?${buildQuery(filters, page, size)}`)
  return {
    reports: Array.isArray(res?.reports) ? res.reports : [],
    page: res?.page ?? page,
    size: res?.size ?? size,
    totalElements: res?.totalElements ?? 0,
    totalPages: res?.totalPages ?? 0,
    first: res?.first ?? page === 0,
    last: res?.last ?? true,
  }
}

// 건수만 필요할 때. size=1 로 요청해 totalElements 만 읽는다(행은 1건만 오간다).
export async function fetchReportCount(filters = {}) {
  const res = await apiGet(`/admin/emergency-reports?${buildQuery(filters, 0, 1)}`)
  return res?.totalElements ?? 0
}

// KPI 4종. 페이지네이션과 무관하게 항상 전체 기준이라 화면을 넘겨도 숫자가 흔들리지 않는다.
// 기간 필터가 걸려 있으면 그 기간 기준으로 집계한다.
export async function fetchReportStats(filters = {}) {
  const base = { startDate: filters.startDate, endDate: filters.endDate }
  const [total, received, resolved, falseCount] = await Promise.all([
    fetchReportCount(base),
    fetchReportCount({ ...base, statusFilter: 'RECEIVED' }),
    fetchReportCount({ ...base, statusFilter: 'RESOLVED' }),
    fetchReportCount({ ...base, statusFilter: 'FALSE' }),
  ])
  return { total, received, resolved, falseCount }
}
