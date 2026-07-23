import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import { TAB_BAR_HEIGHT } from '../components/layout/MobileTabBar'
import useIsMobile from '../hooks/useIsMobile'
import { apiGet, apiSend } from '../utils/adminApi'

const dayOf = (iso) => String(iso ?? '').slice(0, 10)
const fmtTime = (iso) => String(iso ?? '').slice(11, 16)
const fmtDay = (d) => {
  if (!d || d.length < 10) return ''
  const today = new Date().toISOString().slice(0, 10)
  if (d === today) return '오늘'
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`
}
// 방 목록의 시간 — 오늘이면 HH:mm, 아니면 MM-DD
const fmtShort = (iso) => {
  const s = String(iso ?? '')
  if (s.length < 10) return ''
  return dayOf(s) === new Date().toISOString().slice(0, 10) ? s.slice(11, 16) : s.slice(5, 10)
}

// 닉네임에서 결정적으로 아바타 색을 고른다 (목록에서 상대를 색으로 구분하기 위함)
const PALETTE = [['#2563EB', '#1E40AF'], ['#0EA5E9', '#2563EB'], ['#6366F1', '#4338CA'], ['#0891B2', '#0E7490']]
const paletteOf = (name) => {
  const s = String(name ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function Avatar({ name, size = 44 }) {
  const [c1, c2] = paletteOf(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 700, color: '#fff',
      background: `linear-gradient(135deg,${c1},${c2})`,
    }}>{(name || '?').charAt(0)}</div>
  )
}

function Empty({ text }) {
  return <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '48px 20px' }}>{text}</div>
}

export default function MessagesPage({ user, onLogout }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()

  // 받은/보낸을 한 배열로 정규화해 들고 있는다.
  // { messageId, peerId, peerName, dir: 'in'|'out', content, isRead, createdAt }
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [selPeer, setSelPeer] = useState(null)   // 열려 있는 대화방의 상대 userId (문자열)
  const [friends, setFriends] = useState([])     // { friendsId, friendUserId, friendNickname, ... }
  const [picking, setPicking] = useState(false)  // 새 대화 시작 — 친구 고르기
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const bodyRef = useRef(null)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      // 두 목록 모두 content 를 포함하므로 대화 내용은 이것만으로 구성된다.
      // (GET /messages/{id} 는 읽음 처리 부수효과 때문에만 쓴다)
      const [rc, st] = await Promise.all([
        apiGet('/messages/received').catch(() => []),
        apiGet('/messages/sent').catch(() => []),
      ])
      const norm = [
        ...(Array.isArray(rc) ? rc : []).map(m => ({
          messageId: m.messageId, peerId: m.senderId, peerName: m.senderNickname,
          dir: 'in', content: m.content, isRead: m.isRead, createdAt: m.createdAt,
        })),
        ...(Array.isArray(st) ? st : []).map(m => ({
          messageId: m.messageId, peerId: m.receiverId, peerName: m.receiverNickname,
          dir: 'out', content: m.content, isRead: m.isRead, createdAt: m.createdAt,
        })),
      ]
      norm.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      setItems(norm)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // 새 대화 상대 후보 — 백엔드가 친구(ACCEPTED)에게만 발송을 허용한다
  useEffect(() => {
    if (!user) return
    apiGet('/friends').then(v => setFriends(Array.isArray(v) ? v : [])).catch(() => setFriends([]))
  }, [user])

  // 상대별로 묶어 대화방을 만든다 (최근 대화 순)
  const rooms = useMemo(() => {
    const map = new Map()
    for (const m of items) {
      if (m.peerId == null) continue
      const key = String(m.peerId)
      if (!map.has(key)) map.set(key, { peerId: key, peerName: m.peerName, msgs: [], unread: 0 })
      const r = map.get(key)
      if (m.peerName) r.peerName = m.peerName
      r.msgs.push(m)
      if (m.dir === 'in' && !m.isRead) r.unread++
    }
    return [...map.values()].sort((a, b) =>
      String(b.msgs[b.msgs.length - 1].createdAt).localeCompare(String(a.msgs[a.msgs.length - 1].createdAt)))
  }, [items])

  // 아직 주고받은 쪽지가 없는 친구를 고른 경우엔 빈 방을 만들어준다
  const room = useMemo(() => {
    if (selPeer == null) return null
    const found = rooms.find(r => r.peerId === String(selPeer))
    if (found) return found
    const f = friends.find(x => String(x.friendUserId) === String(selPeer))
    return { peerId: String(selPeer), peerName: f?.friendNickname ?? '', msgs: [], unread: 0 }
  }, [selPeer, rooms, friends])

  const openRoom = (peerId) => { setSelPeer(String(peerId)); setDraft('') }

  // 열려 있는 방의 안 읽은 쪽지를 읽음 처리한다.
  // 일괄 처리 엔드포인트가 없어 건별 상세 조회(부수효과)로 대신한다.
  // 처리 후 isRead 가 true 가 되어 이 효과는 곧바로 조기 반환한다.
  useEffect(() => {
    if (!room) return
    const unread = room.msgs.filter(m => m.dir === 'in' && !m.isRead)
    if (unread.length === 0) return
    let alive = true
    ;(async () => {
      await Promise.all(unread.map(m => apiGet(`/messages/${m.messageId}`).catch(() => null)))
      if (!alive) return
      setItems(prev => prev.map(m => (unread.some(u => u.messageId === m.messageId) ? { ...m, isRead: true } : m)))
    })()
    return () => { alive = false }
  }, [room])

  // 친구 관리에서 '쪽지' 버튼으로 넘어온 경우 해당 대화방을 바로 연다
  useEffect(() => {
    const t = location.state?.to
    if (t == null) return
    setSelPeer(String(t))
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  // 방을 열거나 새 쪽지가 붙으면 맨 아래로 (카톡과 동일)
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [selPeer, room?.msgs.length])

  const send = async () => {
    const content = draft.trim()
    if (!room || !content || sending) return
    setSending(true)
    try {
      await apiSend(`/messages/${room.peerId}`, 'POST', { content })
      setDraft('')
      await load()
    } catch (e) {
      alert('쪽지 전송 실패: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  // 대화 삭제 — 백엔드는 건별 소프트 삭제만 있어 방 안의 쪽지를 모두 지운다(내 쪽에서만 사라진다)
  const deleteRoom = async () => {
    if (!room || room.msgs.length === 0) return
    if (!window.confirm(`'${room.peerName}' 님과의 대화를 삭제할까요?\n내 쪽에서만 삭제되며 상대에게는 남습니다.`)) return
    const results = await Promise.all(
      room.msgs.map(m => apiSend(`/messages/${m.messageId}`, 'DELETE').then(() => true).catch(() => false)))
    const failed = results.filter(ok => !ok).length
    if (failed > 0) alert(`쪽지 ${failed}개를 삭제하지 못했습니다.`)
    setSelPeer(null)
    load()
  }

  const startWith = (friendUserId) => { setPicking(false); openRoom(friendUserId) }

  /* ---------------- 조각 ---------------- */

  const roomList = loading ? <Empty text="불러오는 중..." />
    : rooms.length === 0 ? <Empty text="주고받은 쪽지가 없습니다. '새 쪽지'로 친구와 대화를 시작해보세요." />
      : rooms.map(r => {
        const last = r.msgs[r.msgs.length - 1]
        const active = room?.peerId === r.peerId
        return (
          <div key={r.peerId} onClick={() => openRoom(r.peerId)} style={{
            background: 'var(--surface)',
            border: `1px solid ${active ? 'var(--blue-primary)' : 'var(--border)'}`,
            borderRadius: isMobile ? 15 : 14, padding: isMobile ? 14 : '13px 15px', cursor: 'pointer', flexShrink: 0,
            boxShadow: active && !isMobile ? '0 4px 14px rgba(37,99,235,.14)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Avatar name={r.peerName} size={isMobile ? 44 : 42} />
              {/* minWidth:0 — 닉네임이 길면 시간이 카드 밖으로 밀린다 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: isMobile ? 14.5 : 14, fontWeight: r.unread ? 800 : 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.peerName || '(알 수 없음)'}</span>
                  {r.unread > 0 && (
                    <span style={{
                      fontFamily: "'Inter',sans-serif", background: 'var(--danger)', color: '#fff', fontSize: 10.5, fontWeight: 700,
                      minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{r.unread}</span>
                  )}
                </div>
                <div style={{
                  fontSize: 12.5, lineHeight: 1.5, marginTop: 4,
                  color: r.unread ? 'var(--text-strong)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {last.dir === 'out' && <span style={{ color: 'var(--text-muted)' }}>나: </span>}
                  {String(last.content ?? '').replace(/\s*\n+\s*/g, ' ')}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontFamily: "'Inter',sans-serif", alignSelf: 'flex-start', marginTop: 2 }}>{fmtShort(last.createdAt)}</span>
            </div>
          </div>
        )
      })

  // 말풍선 목록 — 날짜가 바뀌면 구분선을 끼운다
  const thread = (
    <div ref={bodyRef} className="ls-scroll" style={{
      flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '16px 14px' : '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {room && room.msgs.length === 0 ? (
        <Empty text={`${room.peerName} 님과의 첫 쪽지를 보내보세요.`} />
      ) : room?.msgs.map((m, i) => {
        const prev = room.msgs[i - 1]
        const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt)
        const mine = m.dir === 'out'
        return (
          <div key={m.messageId}>
            {newDay && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 14px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{fmtDay(dayOf(m.createdAt))}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 7 }}>
              {mine && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  {m.isRead && <span style={{ fontSize: 10, color: 'var(--blue-primary)', fontWeight: 700 }}>읽음</span>}
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>{fmtTime(m.createdAt)}</span>
                </div>
              )}
              <div style={{
                maxWidth: isMobile ? '78%' : '68%', padding: '10px 14px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: mine ? 'var(--blue-primary)' : 'var(--surface)',
                color: mine ? '#fff' : 'var(--text-strong)',
                border: mine ? 'none' : '1px solid var(--border)',
                borderRadius: 16, borderBottomRightRadius: mine ? 5 : 16, borderBottomLeftRadius: mine ? 16 : 5,
              }}>{m.content}</div>
              {!mine && (
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>{fmtTime(m.createdAt)}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const canSend = !!draft.trim() && !sending
  const inputBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* minWidth:0 — flex 기본 min-width:auto 면 입력칸이 고유폭 아래로 못 줄어 버튼을 밀어낸다 */}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value.slice(0, 1000))}
        // 한글 조합 중 Enter 는 무시한다 (조합 확정용 Enter 로 전송되면 안 된다)
        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
        placeholder={`${room?.peerName ?? ''} 님에게 쪽지 보내기`}
        style={{
          flex: 1, minWidth: 0, height: 44, padding: '0 15px', background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 12,
          fontSize: 13.5, color: 'var(--text-strong)', outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button onClick={send} disabled={!canSend} style={{
        display: 'flex', alignItems: 'center', gap: 7, height: 44, padding: '0 18px', border: 'none', borderRadius: 12,
        background: canSend ? 'var(--blue-primary)' : 'var(--border)', color: canSend ? '#fff' : 'var(--text-muted)',
        fontSize: 13.5, fontWeight: 700, cursor: canSend ? 'pointer' : 'default',
        whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
        {sending ? '전송 중' : '보내기'}
      </button>
    </div>
  )

  const roomHeader = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '12px 14px' : '16px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {isMobile && (
        <button onClick={() => setSelPeer(null)} style={{
          width: 34, height: 34, marginLeft: -8, border: 'none', background: 'transparent',
          color: 'var(--text-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
      )}
      <Avatar name={room?.peerName} size={isMobile ? 38 : 42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room?.peerName}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>쪽지 {room?.msgs.length ?? 0}개</div>
      </div>
      {room && room.msgs.length > 0 && (
        <button onClick={deleteRoom} title="대화 삭제" style={{
          width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)',
          color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
        </button>
      )}
    </div>
  )

  // 새 대화 — 친구 고르기
  const friendPicker = (
    <>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>대화할 친구를 선택하세요</div>
      {friends.length === 0 ? (
        <Empty text="친구가 없어 쪽지를 보낼 수 없습니다. 먼저 친구를 추가해주세요." />
      ) : (
        <div className="ls-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {friends.map(f => (
            <div key={f.friendUserId} onClick={() => startWith(f.friendUserId)} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer',
            }}>
              <Avatar name={f.friendNickname} size={38} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.friendNickname}</span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        친구로 등록된 사용자에게만 쪽지를 보낼 수 있습니다.
      </div>
    </>
  )

  const newBtnLabel = '새 쪽지'

  /* ---------------- 모바일 ---------------- */

  if (isMobile) {
    return (
      <UserShell user={user} onLogout={onLogout} active="myinfo">
        {room ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ background: 'var(--surface)' }}>{roomHeader}</div>
            {thread}
            {/* 대화방 안에서는 작성 시트 없이 바로 보낸다 */}
            {/* 탭바가 이 아래에 붙어 있으므로 safe-area 여백은 탭바가 처리한다 */}
            <div style={{
              flexShrink: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 14px',
            }}>{inputBar}</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => navigate('/myinfo')} style={{
                  width: 36, height: 36, marginLeft: -8, border: 'none', background: 'transparent',
                  color: 'var(--text-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                </button>
                <span style={{ fontSize: 19, fontWeight: 800 }}>쪽지</span>
              </div>
            </div>
            <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>{roomList}</div>

            <button onClick={() => setPicking(true)} style={{
              position: 'fixed', right: 18, height: 52, padding: '0 20px',
              bottom: `calc(${TAB_BAR_HEIGHT}px + 18px + env(safe-area-inset-bottom) + var(--ls-sheet-peek, 0px))`,
              border: 'none', borderRadius: 26, background: 'var(--blue-primary)', color: '#fff', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 22px rgba(37,99,235,.4)', cursor: 'pointer', zIndex: 30, fontFamily: 'inherit',
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H5.2L4 17.5z" /></svg>
              {newBtnLabel}
            </button>
          </>
        )}

        {/* 새 대화 바텀시트 — 처음 말 거는 상대를 고를 때만 뜬다 */}
        {picking && (
          <>
            <div onClick={() => setPicking(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.42)', zIndex: 40 }} />
            <div style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--surface)',
              borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 30px rgba(15,23,42,.18)', zIndex: 41,
              padding: '9px 18px 22px', paddingBottom: 'calc(22px + env(safe-area-inset-bottom))',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 3 }}>
                <span style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 14px' }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>새 쪽지</span>
                <button onClick={() => setPicking(false)} style={{
                  width: 34, height: 34, marginRight: -8, border: 'none', background: 'transparent',
                  color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              {friendPicker}
            </div>
          </>
        )}
      </UserShell>
    )
  }

  /* ---------------- 데스크탑 ---------------- */

  return (
    <UserShell user={user} onLogout={onLogout} active="myinfo">
      {/* 셸의 <main>이 확정 높이를 주므로 height:100% 로 화면을 꽉 채운다.
          방 목록과 대화 내용만 각자 내부 스크롤을 갖고 페이지에는 스크롤이 생기지 않는다. */}
      <div style={{ maxWidth: 1560, margin: '0 auto', padding: '26px 48px 28px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
              <span onClick={() => navigate('/myinfo')} style={{ cursor: 'pointer' }}>내 정보</span>
              <span style={{ color: 'var(--border)' }}>/</span>
              <span>쪽지</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px', marginTop: 4 }}>쪽지</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>친구와 주고받은 대화를 확인하세요</div>
          </div>
          <button onClick={() => setPicking(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, height: 44, padding: '0 20px', border: 'none', borderRadius: 12,
            background: 'var(--blue-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(37,99,235,.28)', fontFamily: 'inherit',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H5.2L4 17.5z" /></svg>
            {newBtnLabel}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, marginTop: 20 }}>
          {/* 대화방 목록 — 대화창보다 길어지면 이 칸만 스크롤된다 */}
          <div className="ls-scroll" style={{ width: 420, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, paddingRight: 4 }}>
            {roomList}
          </div>

          {/* 대화 */}
          <div style={{
            flex: 1, minWidth: 0, background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {!room ? (
              <Empty text="왼쪽에서 대화를 선택하거나 '새 쪽지'로 시작하세요." />
            ) : (
              <>
                <div style={{ background: 'var(--surface)' }}>{roomHeader}</div>
                {thread}
                <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '14px 22px' }}>{inputBar}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 새 대화 모달 */}
      {picking && (
        <div onClick={() => setPicking(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,.42)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 460, background: 'var(--surface)', borderRadius: 18,
            boxShadow: '0 24px 60px rgba(15,23,42,.24)', padding: '20px 24px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>새 쪽지</div>
              <button onClick={() => setPicking(false)} style={{
                width: 34, height: 34, marginRight: -6, border: 'none', background: 'transparent',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {friendPicker}
          </div>
        </div>
      )}
    </UserShell>
  )
}
