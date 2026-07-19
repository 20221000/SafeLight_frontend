// 백엔드 응답 공용 파서.
//
// 백엔드는 { success, data, message } 봉투를 쓰지만, 401·403·500 에서는 본문이 아예 비어서 온다.
// 그때 res.json() 을 그냥 부르면 'Unexpected end of JSON input' SyntaxError 가 터지면서
// 진짜 원인(상태코드)을 가려버린다. 여기서 한 번 걸러 항상 봉투 모양으로 돌려준다.
//
// 사용: const json = await readEnvelope(res)  →  { success, data, message, status }
//       기존 코드의 json.success / json.data 사용법이 그대로 통한다.

const STATUS_MESSAGE = {
  400: '요청 내용을 확인해주세요.',
  401: '로그인이 필요합니다.',
  403: '접근 권한이 없습니다. 로그인 후 다시 시도해주세요.',
  404: '요청한 정보를 찾을 수 없습니다.',
  409: '이미 처리된 요청입니다.',
  500: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
}

export const statusMessage = (status) =>
  STATUS_MESSAGE[status] || `요청에 실패했습니다. (HTTP ${status})`

export async function readEnvelope(res) {
  const text = await res.text().catch(() => '')

  let json = null
  if (text) {
    try { json = JSON.parse(text) } catch { json = null }
  }

  // 봉투가 제대로 왔으면 그대로 쓴다. 단, 상태코드가 실패인데 success:true 인 모순은 실패로 본다.
  if (json && typeof json.success === 'boolean') {
    if (!res.ok && json.success) {
      return { success: false, data: null, message: statusMessage(res.status), status: res.status }
    }
    return { ...json, message: json.message || (res.ok ? '' : statusMessage(res.status)), status: res.status }
  }

  // 본문이 비었거나 JSON 이 아닌 경우 (403 빈 응답, 프록시 HTML 에러 페이지 등)
  return {
    success: res.ok,
    data: null,
    message: res.ok ? '' : statusMessage(res.status),
    status: res.status,
  }
}
