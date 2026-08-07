import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import useIsMobile from '../hooks/useIsMobile'
import { apiGet, apiSend } from '../utils/adminApi'

const TABS = ['친구 목록', '받은 요청', '보낸 요청']

function Toggle({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{
      width: 42, height: 24, borderRadius: 12, background: checked ? 'var(--blue-primary)' : 'var(--border)',
      cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </div>
  )
}

// 긴급공유는 방향이 둘이다. 내 쪽은 토글로 바꾸고, 상대 쪽은 읽기 전용 배지로 보여준다.
function ShareBadge({ on }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 8, whiteSpace: 'nowrap',
      background: on ? 'var(--blue-tint)' : 'var(--bg)',
      color: on ? 'var(--blue-primary)' : 'var(--text-muted)',
      border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
    }}>{on ? 'ON' : 'OFF'}</span>
  )
}

function Avatar({ name }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--blue-tint)', color: 'var(--blue-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
      {(name || '?').charAt(0)}
    </div>
  )
}

export default function FriendsPage({ user, onLogout }) {
  const isMobile = useIsMobile() // 모바일: 페이지 여백 축소(데스크탑 48/30px는 375px에서 너무 넓다)
  const navigate = useNavigate()
  const [tab, setTab] = useState('친구 목록')
  const [search, setSearch] = useState('')

  // isEmergencyAllowed = 내가 상대에게 내 위치를 공유하는지
  // isEmergencyAllowedByFriend = 상대가 나에게 자기 위치를 공유하는지 (이게 OFF면 상대 긴급 위치 조회가 403)
  const [friends, setFriends] = useState([])          // { friendsId, friendUserId, friendNickname, isEmergencyAllowed, isEmergencyAllowedByFriend }
  const [received, setReceived] = useState([])         // { requestId, senderId, senderNickname }
  const [sent, setSent] = useState([])                 // { requestId, receiverId, receiverNickname }
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [fl, rc, st] = await Promise.all([
        apiGet('/friends').catch(() => []),
        apiGet('/friends/requests/received').catch(() => []),
        apiGet('/friends/requests/sent').catch(() => []),
      ])
      setFriends(Array.isArray(fl) ? fl : [])
      setReceived(Array.isArray(rc) ? rc : [])
      setSent(Array.isArray(st) ? st : [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // 친구 요청: POST /friends/requests 는 targetUserId(숫자)를 받음.
  // 닉네임→userId 검색 엔드포인트가 없어 현재는 사용자 ID 직접 입력(임시).
  const handleAddFriend = async () => {
    const v = search.trim()
    if (!v) { alert('친구의 사용자 ID를 입력해주세요.'); return }
    const targetUserId = Number(v)
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      alert('현재는 사용자 ID(숫자)로만 친구 요청이 가능합니다. (닉네임 검색은 준비 중)')
      return
    }
    try {
      await apiSend('/friends/requests', 'POST', { targetUserId })
      alert('친구 요청을 보냈습니다.')
      setSearch('')
      load()
    } catch (e) {
      alert('친구 요청 실패: ' + e.message)
    }
  }

  const accept = async (requestId) => {
    try { await apiSend(`/friends/requests/${requestId}/accept`, 'PUT'); load() }
    catch (e) { alert('수락 실패: ' + e.message) }
  }
  const reject = async (requestId) => {
    try { await apiSend(`/friends/requests/${requestId}/reject`, 'PUT'); load() }
    catch (e) { alert('거절 실패: ' + e.message) }
  }
  const cancel = async (requestId) => {
    try { await apiSend(`/friends/requests/${requestId}`, 'DELETE'); load() }
    catch (e) { alert('취소 실패: ' + e.message) }
  }
  const removeFriend = async (friendUserId, nickname) => {
    if (!window.confirm(`'${nickname}' 님을 친구에서 삭제할까요?`)) return
    try { await apiSend(`/friends/${friendUserId}`, 'DELETE'); load() }
    catch (e) { alert('친구 삭제 실패: ' + e.message) }
  }
  // 백엔드 EmergencyAllowUpdateRequest 는 isEmergencyAllowed 를 필수 본문으로 받는다.
  // 예전엔 본문 없이 PUT 을 던져 "Required request body is missing" 400 으로 매번 실패했다.
  const toggleEmergency = async (friend) => {
    const next = !friend.isEmergencyAllowed
    try {
      const updated = await apiSend(`/friends/${friend.friendsId}/emergency-allow`, 'PUT', { isEmergencyAllowed: next })
      // 응답에 양방향 설정이 다 들어 있어 목록 3종을 다시 받지 않고 그 행만 갱신한다.
      if (updated) setFriends(prev => prev.map(f => (f.friendsId === friend.friendsId ? { ...f, ...updated } : f)))
      else load()
    } catch (e) {
      alert('설정 변경 실패: ' + e.message)
    }
  }

  const counts = { '친구 목록': friends.length, '받은 요청': received.length, '보낸 요청': sent.length }

  return (
    <UserShell user={user} onLogout={onLogout} active="myinfo">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 16px 24px' : '26px 48px', display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px' }}>친구 관리</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>긴급 위치 공유를 허용할 친구를 관리하세요</div>
          {/* 공유 설정은 한쪽만 켜도 되는 단방향이다. 두 열이 뭘 뜻하는지 여기서 한 번 설명한다. */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
            <b style={{ color: 'var(--text-strong)' }}>내 공유</b>는 내 긴급 위치를 그 친구에게 보여줄지,
            <b style={{ color: 'var(--text-strong)' }}> 상대 공유</b>는 그 친구가 나에게 허용했는지입니다.
            상대 공유가 <b>OFF</b>면 그 친구의 긴급 위치는 열람할 수 없습니다.
          </div>
        </div>

        {/* 친구 추가 (현재는 사용자 ID로 요청 — 닉네임 검색 API 준비 중) */}
        <div>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* minWidth:0 필수 — flex 기본 min-width:auto 면 검색칸이 고유폭(약 179px) 아래로
                줄지 못해 좁은 화면에서 '친구 요청' 버튼을 화면 밖으로 밀어낸다. */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, height: 46, padding: '0 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddFriend()} placeholder="친구의 사용자 ID(숫자) 입력" style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: 'var(--text-strong)', fontFamily: 'inherit' }} />
            </div>
            <button onClick={handleAddFriend} style={{ height: 46, padding: '0 20px', border: 'none', borderRadius: 12, background: 'var(--blue-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>친구 요청</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>* 상대방의 <b>내 정보 &gt; ID</b>에 표시된 숫자로 친구 요청을 보낼 수 있습니다.</div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map(t => {
            const on = tab === t
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, background: on ? 'var(--blue-primary)' : 'var(--surface)',
                color: on ? '#fff' : 'var(--text-muted)', fontWeight: on ? 700 : 500,
              }}>
                {t}
                <span style={{ background: on ? 'rgba(255,255,255,.25)' : 'var(--bg)', color: on ? '#fff' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, fontFamily: "'Inter',sans-serif" }}>{counts[t]}</span>
              </button>
            )
          })}
        </div>

        {/* 리스트 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 8 }}>
          {loading ? (
            <Empty text="불러오는 중..." />
          ) : tab === '친구 목록' ? (
            friends.length === 0
              ? <Empty text="아직 친구가 없습니다. 위에서 사용자 ID로 요청을 보내보세요." />
              : friends.map(f => {
                // 쪽지 쓰기 — 쪽지함으로 이동하며 받는 사람을 미리 지정한다.
                // 모바일은 행이 좁아 아이콘만 남긴다.
                const messageBtn = (
                  <button
                    title={`${f.friendNickname} 님에게 쪽지`}
                    onClick={() => navigate('/myinfo/messages', { state: { to: f.friendUserId } })}
                    style={isMobile
                      ? { width: 36, height: 36, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
                      : { ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H5.2L4 17.5z" /></svg>
                    {!isMobile && '쪽지'}
                  </button>
                )
                const deleteBtn = <button style={btnGhost} onClick={() => removeFriend(f.friendUserId, f.friendNickname)}>삭제</button>

                // 내가 보낸 공유(토글) + 상대가 보낸 공유(읽기 전용).
                // 상대 쪽이 OFF면 그 친구의 긴급 위치를 열어도 403이라 미리 알려준다.
                const myShare = (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>내 공유</span>
                    <Toggle checked={f.isEmergencyAllowed} onChange={() => toggleEmergency(f)} />
                  </div>
                )
                const theirShare = (
                  <div
                    title={f.isEmergencyAllowedByFriend
                      ? '이 친구가 긴급 상황일 때 위치를 볼 수 있습니다.'
                      : '이 친구가 아직 나에게 위치 공유를 허용하지 않았습니다.'}
                    style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                  >
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>상대 공유</span>
                    <ShareBadge on={Boolean(f.isEmergencyAllowedByFriend)} />
                  </div>
                )

                // 모바일 375px 에서는 한 줄에 다 못 넣는다. 이름/버튼 줄과 공유 설정 줄로 나눈다.
                if (isMobile) {
                  return (
                    <div key={f.friendsId} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={f.friendNickname} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.friendNickname}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID {f.friendUserId}</div>
                        </div>
                        {messageBtn}
                        {deleteBtn}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        {myShare}
                        {theirShare}
                      </div>
                    </div>
                  )
                }

                return (
                  <Row key={f.friendsId}>
                    <Avatar name={f.friendNickname} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{f.friendNickname}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID {f.friendUserId}</div>
                    </div>
                    {myShare}
                    {theirShare}
                    {messageBtn}
                    {deleteBtn}
                  </Row>
                )
              })
          ) : tab === '받은 요청' ? (
            received.length === 0
              ? <Empty text="받은 친구 요청이 없습니다." />
              : received.map(r => (
                <Row key={r.requestId}>
                  <Avatar name={r.senderNickname} />
                  {/* minWidth:0 — 닉네임이 길면 수락·거절 버튼이 칸 밖으로 밀린다. */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.senderNickname}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID {r.senderId}</div>
                  </div>
                  <button style={btnPrimary} onClick={() => accept(r.requestId)}>수락</button>
                  <button style={btnGhost} onClick={() => reject(r.requestId)}>거절</button>
                </Row>
              ))
          ) : (
            sent.length === 0
              ? <Empty text="보낸 친구 요청이 없습니다." />
              : sent.map(r => (
                <Row key={r.requestId}>
                  <Avatar name={r.receiverNickname} />
                  {/* minWidth:0 — 닉네임이 길면 '대기중'·취소가 칸 밖으로 밀린다. */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.receiverNickname}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID {r.receiverId}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>대기중</span>
                  <button style={btnGhost} onClick={() => cancel(r.requestId)}>취소</button>
                </Row>
              ))
          )}
        </div>
      </div>
    </UserShell>
  )
}

function Row({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>{children}</div>
}
function Empty({ text }) {
  return <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px' }}>{text}</div>
}

const btnPrimary = { height: 36, padding: '0 16px', border: 'none', borderRadius: 10, background: 'var(--blue-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost = { height: 36, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
