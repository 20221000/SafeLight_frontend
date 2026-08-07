// 알림함 — 친구의 긴급신고(SOS)와 친구가 보낸 쪽지를 한 줄기로 모아 본다.
//
// GET   /notifications                          긴급 알림 목록
// PATCH /notifications/{id}/read                긴급 알림 읽음 처리
// GET   /emergency-reports/{id}/shared-location 정확 위치 (허용된 친구만, 아니면 403)
// GET   /messages/received                      받은 쪽지 목록
// GET   /messages/{id}                          쪽지 상세 — 열면 서버가 읽음으로 바꾼다
//
// **왜 두 곳에서 받아 오나:** 백엔드 notifications 테이블은 emergency_report_id 가 NOT NULL 이라
// 쪽지 알림을 담을 수 없다. 그래서 쪽지는 쪽지 API 에서 그대로 가져와 시간순으로 섞는다.
// 숫자도 내용도 서버가 준 값 그대로이고 둘 다 정식 API 다 — 한 테이블로 합치는 건 백엔드 요청 10번.
//
// 두 종류는 색으로 나눈다: 긴급은 빨강(사이렌), 쪽지는 파랑(봉투). 벨 아이콘도 같은 규칙이다.
//
// 데스크탑은 좌측 목록 + 우측 상세, 모바일은 목록 → 상세 전환(뒤로가기 버튼)으로 같은 데이터를 쓴다.
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import { TAB_BAR_HEIGHT } from '../components/layout/MobileTabBar'
import useIsMobile from '../hooks/useIsMobile'
import Icon from '../components/Icon'
import { readEnvelope } from '../utils/apiResponse'
import { notifyNotificationsChanged } from '../hooks/useUnreadNotifications'

const LEVEL_STYLE = {
  HIGH:   { label: '위험', color: 'var(--danger)',  bg: 'rgba(225,29,72,.10)' },
  MEDIUM: { label: '주의', color: 'var(--warning)', bg: 'rgba(245,158,11,.13)' },
  LOW:    { label: '관심', color: 'var(--safe)',    bg: 'rgba(16,185,129,.13)' },
}
const STATUS_LABEL = { RECEIVED: '접수', RESOLVED: '해결', FALSE: '오탐' }

// 알림 종류별 색. 벨 아이콘(NotificationBell)과 같은 규칙을 쓴다 —
// 목록에서 파란 점이던 것이 벨에서 빨간 점이 되면 사용자는 매번 다시 읽어야 한다.
const KIND_STYLE = {
  emergency: { color: 'var(--danger)',       tint: 'rgba(225,29,72,.10)', rowBg: 'rgba(225,29,72,.04)' },
  message:   { color: 'var(--blue-primary)', tint: 'var(--blue-tint)',    rowBg: 'rgba(37,99,235,.045)' },
}

// 쪽지는 **보낸 사람별로 한 줄**로 묶는다. 한 통에 한 줄이면 수다스러운 친구 하나가
// 목록을 다 차지해서 정작 긴급 알림이 아래로 밀려난다.
//
// 묶은 줄은 가장 최근 쪽지를 보여주고, 그 사람의 안 읽은 쪽지를 전부 들고 있는다 —
// 줄 하나를 열면 그 사람의 안 읽은 쪽지가 다 읽음 처리돼야 벨의 파란 점이 사라진다.
// (쪽지함도 대화방을 열면 그 방의 안 읽은 쪽지를 모두 읽음으로 바꾼다. 규칙을 맞춘다.)
function groupMessagesBySender(messages) {
  const bySender = new Map()

  for (const m of messages) {
    const id = String(m.senderId)
    if (!bySender.has(id)) {
      bySender.set(id, { senderId: m.senderId, senderNickname: m.senderNickname, latest: m, unreadIds: [], total: 0 })
    }
    const g = bySender.get(id)
    g.total += 1
    // 서버 정렬을 믿지 않고 직접 고른다 — 두 목록을 섞는 마당에 여기만 순서를 가정할 이유가 없다.
    if (String(m.createdAt ?? '') > String(g.latest.createdAt ?? '')) g.latest = m
    if (!m.isRead) g.unreadIds.push(m.messageId)
  }

  return [...bySender.values()].map(g => ({
    key: `m${g.senderId}`,
    kind: 'message',
    createdAt: g.latest.createdAt,
    isRead: g.unreadIds.length === 0,
    title: `${g.senderNickname ?? '친구'}님의 쪽지`,
    preview: g.latest.content || '내용 없음',
    unreadCount: g.unreadIds.length,
    raw: g,
  }))
}

const fmtFull = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '-')
// 목록용 — 오늘이면 HH:mm, 아니면 MM-DD
const fmtShort = (iso) => {
  const s = String(iso ?? '')
  if (s.length < 10) return ''
  return s.slice(0, 10) === new Date().toISOString().slice(0, 10) ? s.slice(11, 16) : s.slice(5, 10)
}

// 신고 위치 미니 지도. 카카오 SDK는 index.html에서 이미 불러온다.
function MiniMap({ lat, lng, height }) {
  const boxRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (lat == null || lng == null) return
    let alive = true

    const draw = () => {
      if (!alive || !boxRef.current || !window.kakao?.maps) return
      const center = new window.kakao.maps.LatLng(lat, lng)

      if (!mapRef.current) {
        mapRef.current = new window.kakao.maps.Map(boxRef.current, { center, level: 4 })
      } else {
        mapRef.current.relayout()
        mapRef.current.setCenter(center)
      }
      // 위치가 바뀌면 이전 마커를 걷어낸다 — 안 그러면 지도에 마커가 쌓인다.
      if (markerRef.current) markerRef.current.setMap(null)
      markerRef.current = new window.kakao.maps.Marker({ position: center, map: mapRef.current })
    }

    if (window.kakao?.maps) {
      draw()
      return () => { alive = false }
    }
    const timer = setInterval(() => {
      if (window.kakao?.maps) { clearInterval(timer); draw() }
    }, 300)
    return () => { alive = false; clearInterval(timer) }
  }, [lat, lng])

  return <div ref={boxRef} style={{ width: '100%', height, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }} />
}

function Empty({ text }) {
  return <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '48px 20px' }}>{text}</div>
}

export default function NotificationsPage({ user, onLogout }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [shared, setShared] = useState(null)          // 위치 공유 조회 결과
  const [sharedError, setSharedError] = useState('')  // 권한 없음 등 사유
  const [sharedLoading, setSharedLoading] = useState(false)

  const token = localStorage.getItem('accessToken')
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  const load = useCallback(async () => {
    if (!user || !token) { setLoading(false); return }
    setLoading(true)
    const headers = { Authorization: `Bearer ${token}` }

    const fetchList = async (url) => {
      const json = await readEnvelope(await fetch(url, { headers }))
      if (!json.success) { console.warn(`${url} 조회 실패:`, json.message); return [] }
      return Array.isArray(json.data) ? json.data : []
    }

    try {
      // 한쪽이 죽어도 다른 쪽은 보여준다 — 쪽지 API 가 막혔다고 긴급 알림까지 가릴 이유가 없다.
      const [alerts, messages] = await Promise.all([
        fetchList('/notifications').catch(() => []),
        fetchList('/messages/received').catch(() => []),
      ])

      // 두 종류를 한 모양으로 맞춘다. key 에 종류를 섞는 이유는 두 테이블의 id 가 겹치기 때문이다.
      const merged = [
        ...alerts.map(n => ({
          key: `n${n.notificationId}`,
          kind: 'emergency',
          createdAt: n.createdAt,
          isRead: Boolean(n.isRead),
          title: n.title || '긴급 알림',
          preview: `${n.reporterNickname ? `${n.reporterNickname} · ` : ''}${n.message || '내용 없음'}`,
          raw: n,
        })),
        ...groupMessagesBySender(messages),
      ]
      // 최신순. 서버가 각자 정렬해 줘도 섞고 나면 다시 세워야 한다.
      merged.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      setItems(merged)
    } catch (err) {
      console.error('알림 조회 실패:', err)
    } finally {
      setLoading(false)
    }
  }, [user, token])

  useEffect(() => { load() }, [load])

  const selected = items.find(n => n.key === selectedId) ?? null

  // 위치 공유는 신고자가 허용한 친구만 볼 수 있다. 막히면 사유를 그대로 보여준다.
  const loadSharedLocation = useCallback(async (reportId) => {
    setShared(null); setSharedError(''); setSharedLoading(true)
    try {
      const res = await fetch(`/emergency-reports/${reportId}/shared-location`, { headers: authHeader })
      const json = await readEnvelope(res)
      if (json.success) setShared(json.data)
      else setSharedError(json.message || '위치를 불러오지 못했습니다.')
    } catch {
      setSharedError('서버에 연결하지 못했습니다.')
    } finally {
      setSharedLoading(false)
    }
    // authHeader 는 렌더마다 새 객체라 의존성에 넣지 않는다(토큰이 실제 입력값이다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // 종류마다 읽음 처리 방법이 다르다.
  // 긴급: PATCH /notifications/{id}/read — 알림 1건 = 줄 1개.
  // 쪽지: 전용 엔드포인트가 없다. GET /messages/{id} 가 수신자에게 읽음을 찍는 부수효과를 갖는다
  //       (MessageService.getMessageDetail). 줄 하나가 그 사람의 쪽지 여러 통을 대표하므로
  //       안 읽은 것을 **전부** 훑어야 벨의 파란 점이 사라진다.
  const markRead = useCallback(async (item) => {
    if (item.isRead) return false
    const send = (url, method) => fetch(url, { method, headers: authHeader }).then(readEnvelope)
    try {
      if (item.kind === 'emergency') {
        const json = await send(`/notifications/${item.raw.notificationId}/read`, 'PATCH')
        if (!json.success) return false
      } else {
        const results = await Promise.all(
          item.raw.unreadIds.map(id => send(`/messages/${id}`, 'GET').catch(() => ({ success: false })))
        )
        // 일부라도 실패하면 아직 안 읽은 게 남아 있다 — 다 읽은 척하지 않는다.
        if (!results.every(r => r.success)) { load(); return false }
      }
      setItems(prev => prev.map(v => (v.key === item.key ? { ...v, isRead: true, unreadCount: 0 } : v)))
      return true
    } catch {
      return false // 읽음 처리 실패는 화면을 막지 않는다
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, load])

  const openItem = async (item) => {
    setSelectedId(item.key)

    if (item.kind === 'emergency') {
      if (item.raw.reportId != null) loadSharedLocation(item.raw.reportId)
      else { setShared(null); setSharedError('연결된 신고가 없습니다.') }
    } else {
      // 쪽지에는 지도가 없다. 이전 신고의 위치가 남아 있으면 엉뚱한 곳을 가리킨다.
      setShared(null); setSharedError('')
    }

    if (await markRead(item)) notifyNotificationsChanged() // 셸의 벨 뱃지 갱신
  }

  const markAllRead = async () => {
    const unread = items.filter(n => !n.isRead)
    if (unread.length === 0) return
    // 일괄 처리 엔드포인트가 없어 건별로 보낸다.
    await Promise.all(unread.map(n => markRead(n)))
    notifyNotificationsChanged()
  }

  // 줄 수가 아니라 실제 건수로 센다 — 쪽지 3통이 한 줄로 묶여도 안 읽은 건 3건이다.
  // 벨 툴팁(서버가 센 값)과 숫자가 어긋나지 않아야 한다.
  const unreadCount = items.reduce((sum, n) => sum + (n.isRead ? 0 : (n.unreadCount ?? 1)), 0)

  // ── 목록 ──────────────────────────────────────────────
  const listBody = (
    <>
      {items.length === 0 ? (
        <Empty text={loading ? '불러오는 중…' : '받은 알림이 없습니다.'} />
      ) : items.map(n => {
        const on = n.key === selectedId
        const k = KIND_STYLE[n.kind]
        return (
          <button
            key={n.key}
            onClick={() => openItem(n)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left',
              padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit',
              border: 'none', borderBottom: '1px solid var(--border)',
              background: on ? 'var(--blue-tint)' : n.isRead ? 'transparent' : k.rowBg,
            }}
          >
            <span style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: n.isRead ? 'var(--bg)' : k.tint,
              color: n.isRead ? 'var(--text-muted)' : k.color,
            }}>
              {n.kind === 'emergency'
                ? <Icon name="siren" size={17} />
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H5.2L4 17.5z" /></svg>}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  fontSize: 13.5, fontWeight: n.isRead ? 600 : 800, color: 'var(--text-strong)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{n.title}</span>
                {/* 여러 통을 한 줄로 묶었으니 몇 통인지는 밝힌다. 안 그러면 나머지가 사라진 것처럼 보인다. */}
                {n.unreadCount > 1 && (
                  <span style={{
                    flexShrink: 0, padding: '1px 6px', borderRadius: 8, background: k.color, color: '#fff',
                    fontSize: 10.5, fontWeight: 800, fontFamily: "'Inter',sans-serif",
                  }}>{n.unreadCount}</span>
                )}
                {/* 안 읽음 점도 벨과 같은 색 규칙 — 빨강은 긴급, 파랑은 쪽지.
                    위 개수 뱃지가 이미 같은 뜻이라 둘이 겹칠 때는 점을 뺀다. */}
                {!n.isRead && !(n.unreadCount > 1) && <span style={{ width: 7, height: 7, borderRadius: '50%', background: k.color, flexShrink: 0 }} />}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontFamily: "'Inter',sans-serif" }}>
                  {fmtShort(n.createdAt)}
                </span>
              </span>
              <span style={{
                display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{n.preview}</span>
            </span>
          </button>
        )
      })}
    </>
  )

  // ── 상세: 쪽지 ────────────────────────────────────────
  // 지도도 위치 공유도 없다. 내용 전체와 '답장' 한 개면 충분하다.
  const messageDetail = selected?.kind === 'message' && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: isMobile ? '14px 14px 24px' : 20 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>{selected.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: "'Inter',sans-serif" }}>
          {fmtFull(selected.createdAt)}
          {/* 안 읽음 수가 아니라 전체 통수로 적는다 — 열자마자 읽음이 되므로 안 읽음 기준이면 문구가 사라진다. */}
          {selected.raw.total > 1 && <span style={{ fontFamily: 'inherit' }}> · 받은 쪽지 {selected.raw.total}통 중 마지막</span>}
        </div>
      </div>

      {/* 가장 최근 한 통만 보여준다. 줄바꿈을 살린다 — 쪽지는 사람이 쓴 글이라 문단이 뭉개지면 읽기 어렵다. */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '13px 14px', fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {selected.raw.latest.content || '내용이 없습니다.'}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '11px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.raw.senderNickname || '친구'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {selected.raw.total > 1 ? '앞선 쪽지는 쪽지함에서 볼 수 있습니다' : '대화 전체는 쪽지함에서 볼 수 있습니다'}
          </div>
        </div>
        <button
          onClick={() => navigate('/myinfo/messages', { state: { to: selected.raw.senderId } })}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 15px', flexShrink: 0,
            border: 'none', borderRadius: 11, background: 'var(--blue-primary)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H5.2L4 17.5z" /></svg>
          답장하기
        </button>
      </div>
    </div>
  )

  // ── 상세: 긴급신고 ────────────────────────────────────
  const emergencyDetail = selected?.kind === 'emergency' && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: isMobile ? '14px 14px 24px' : 20 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>{selected.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: "'Inter',sans-serif" }}>
          {fmtFull(selected.createdAt)}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 14px', fontSize: 13.5, lineHeight: 1.6 }}>
        {selected.raw.message || '내용이 없습니다.'}
      </div>

      {/* 신고자에게 바로 연락 — 알림은 친구의 SOS 로만 오므로 상대는 항상 친구다(쪽지 발송 조건 충족).
          내 신고로 생긴 알림이 내게 올 일은 없지만, 나 자신에게는 보낼 수 없으니 막아둔다. */}
      {selected.raw.reporterUserId != null && String(selected.raw.reporterUserId) !== String(user.userId) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '11px 14px', borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.raw.reporterNickname || '신고자'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>안전한지 바로 확인해보세요</div>
          </div>
          <button
            onClick={() => navigate('/myinfo/messages', { state: { to: selected.raw.reporterUserId } })}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 15px', flexShrink: 0,
              border: 'none', borderRadius: 11, background: 'var(--blue-primary)', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H5.2L4 17.5z" /></svg>
            쪽지 보내기
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>신고 위치</div>

        {sharedLoading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>위치를 불러오는 중…</div>}

        {!sharedLoading && sharedError && (
          <div style={{
            fontSize: 12.5, lineHeight: 1.6, padding: '12px 14px', borderRadius: 12,
            background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.28)', color: 'var(--text-strong)',
          }}>
            {sharedError}
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              정확한 위치는 신고자가 위치 공유를 허용한 친구에게만 보입니다.
              {/* 친구 관리의 '상대 공유' 열에서 누가 허용했는지 바로 확인할 수 있다. */}
              {' '}
              <button
                onClick={() => navigate('/myinfo/friends')}
                style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'var(--blue-primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >친구 관리에서 확인</button>
            </div>
          </div>
        )}

        {!sharedLoading && shared && (
          <>
            <MiniMap lat={shared.latitude} lng={shared.longitude} height={isMobile ? 220 : 280} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{shared.reporterNickname ?? '-'}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 7,
                background: 'var(--blue-tint)', color: 'var(--blue-primary)',
              }}>{STATUS_LABEL[shared.reportStatus] ?? shared.reportStatus}</span>
              {LEVEL_STYLE[shared.dangerLevel] && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 7,
                  background: LEVEL_STYLE[shared.dangerLevel].bg, color: LEVEL_STYLE[shared.dangerLevel].color,
                }}>{LEVEL_STYLE[shared.dangerLevel].label}</span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>
                {fmtFull(shared.reportedAt)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>
              {Number(shared.latitude).toFixed(5)}, {Number(shared.longitude).toFixed(5)}
            </div>
            {shared.description && (
              <div style={{ fontSize: 13, marginTop: 2 }}>{shared.description}</div>
            )}
          </>
        )}
      </div>
    </div>
  )

  const detailBody = messageDetail || emergencyDetail

  const headerRight = unreadCount > 0 && (
    <button
      onClick={markAllRead}
      style={{
        minHeight: 32, padding: '0 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
        border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}
    >모두 읽음</button>
  )

  if (!user) {
    return (
      <UserShell user={user} onLogout={onLogout} active="myinfo">
        <Empty text="로그인이 필요합니다." />
      </UserShell>
    )
  }

  // ── 모바일: 목록 ↔ 상세 전환 ─────────────────────────
  if (isMobile) {
    return (
      <UserShell user={user} onLogout={onLogout} active="myinfo">
        <div style={{ paddingBottom: TAB_BAR_HEIGHT }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 14px 12px', borderBottom: '1px solid var(--border)',
          }}>
            {selected && (
              <button
                onClick={() => setSelectedId(null)}
                aria-label="목록으로"
                style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>알림</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {loading ? '불러오는 중…' : unreadCount > 0 ? `안 읽음 ${unreadCount}건` : '모두 읽었습니다'}
              </div>
            </div>
            {!selected && headerRight}
          </div>

          {selected ? detailBody : listBody}
        </div>
      </UserShell>
    )
  }

  // ── 데스크탑: 좌 목록 / 우 상세 ──────────────────────
  return (
    <UserShell user={user} onLogout={onLogout} active="myinfo" scroll={false}>
      <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
        <div style={{
          flex: '0 0 380px', width: 380, minWidth: 0, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)', background: 'var(--surface)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            padding: '18px 18px 14px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>알림</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {loading ? '불러오는 중…' : unreadCount > 0 ? `안 읽음 ${unreadCount}건` : '모두 읽었습니다'}
              </div>
            </div>
            {headerRight}
          </div>
          <div className="ls-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {listBody}
          </div>
        </div>

        <div className="ls-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {selected ? detailBody : <Empty text="알림을 선택하면 내용을 볼 수 있습니다." />}
        </div>
      </div>
    </UserShell>
  )
}
