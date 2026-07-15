// 관리자 신고 집계 공용 유틸
// 현재 백엔드에는 "전체 신고 조회" 단일 엔드포인트(GET /emergency-reports)가 없어,
// 활성 위험구역별 신고를 모아서 구성한다. (활성 구역 기준이라 비활성화된 구역의 신고는 빠짐)
// TODO(백엔드 연동): GET /emergency-reports(관리자 전체) 추가되면 fetchAllReports를 apiGet('/emergency-reports') 한 줄로 교체.
import { apiGet } from './adminApi'

export async function fetchAllReports() {
  const zones = await apiGet('/danger-zones') // isActive=true 인 구역만 반환됨
  const zoneList = Array.isArray(zones) ? zones : []

  const perZone = await Promise.all(
    zoneList.map(z =>
      apiGet(`/danger-zones/${z.dangerZoneId}/reports`).catch(() => [])
    )
  )

  // reportId 기준 중복 제거 후 최신순 정렬
  const byId = new Map()
  perZone.flat().forEach(r => { if (r && r.reportId != null) byId.set(r.reportId, r) })
  return [...byId.values()].sort(
    (a, b) => String(b.reportedAt ?? '').localeCompare(String(a.reportedAt ?? ''))
  )
}

// 상태별 집계 (RECEIVED/PROCESSING/RESOLVED/FALSE)
export function computeReportStats(reports) {
  const list = Array.isArray(reports) ? reports : []
  return {
    total:      list.length,
    received:   list.filter(r => r.reportStatus === 'RECEIVED').length,
    processing: list.filter(r => r.reportStatus === 'PROCESSING').length,
    resolved:   list.filter(r => r.reportStatus === 'RESOLVED').length,
    falseCount: list.filter(r => r.reportStatus === 'FALSE' || r.isFalseReport).length,
  }
}
