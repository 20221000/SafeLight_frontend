// 관리자 페이지 공용 API 헬퍼
// 모든 백엔드 응답은 { success, data, message } 형태이며, Authorization 헤더로 JWT를 전달한다.

import { readEnvelope } from './apiResponse'

const getToken = () => localStorage.getItem('accessToken')

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(path, { method, headers, body: payload })
  const json = await readEnvelope(res)

  if (!json.success) {
    throw new Error(json.message || '요청에 실패했습니다.')
  }
  return json.data
}

export const apiGet = (path) => apiRequest(path)
export const apiSend = (path, method, body) => apiRequest(path, { method, body })
