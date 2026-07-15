import { useState, useEffect, useCallback } from 'react'
import UserShell from '../components/layout/UserShell'
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

function Avatar({ name }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--blue-tint)', color: 'var(--blue-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
      {(name || '?').charAt(0)}
    </div>
  )
}

export default function FriendsPage({ user, onLogout }) {
  const [tab, setTab] = useState('친구 목록')
  const [search, setSearch] = useState('')

  const [friends, setFriends] = useState([])          // { friendsId, friendUserId, friendNickname, isEmergencyAllowed }
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
  const toggleEmergency = async (friendsId) => {
    try { await apiSend(`/friends/${friendsId}/emergency-allow`, 'PUT'); load() }
    catch (e) { alert('설정 변경 실패: ' + e.message) }
  }

  const counts = { '친구 목록': friends.length, '받은 요청': received.length, '보낸 요청': sent.length }

  return (
    <UserShell user={user} onLogout={onLogout} active="myinfo">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px' }}>친구 관리</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>긴급 위치 공유를 허용할 친구를 관리하세요</div>
        </div>

        {/* 친구 추가 (현재는 사용자 ID로 요청 — 닉네임 검색 API 준비 중) */}
        <div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, height: 46, padding: '0 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddFriend()} placeholder="친구의 사용자 ID(숫자) 입력" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: 'var(--text-strong)', fontFamily: 'inherit' }} />
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
              : friends.map(f => (
                <Row key={f.friendsId}>
                  <Avatar name={f.friendNickname} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{f.friendNickname}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID {f.friendUserId}</div>
                  </div>
                  <span style={{ fontSize: 11.5, color: f.isEmergencyAllowed ? 'var(--blue-primary)' : 'var(--text-muted)', fontWeight: 600 }}>긴급공유 {f.isEmergencyAllowed ? 'ON' : 'OFF'}</span>
                  <Toggle checked={f.isEmergencyAllowed} onChange={() => toggleEmergency(f.friendsId)} />
                  <button style={btnGhost} onClick={() => removeFriend(f.friendUserId, f.friendNickname)}>삭제</button>
                </Row>
              ))
          ) : tab === '받은 요청' ? (
            received.length === 0
              ? <Empty text="받은 친구 요청이 없습니다." />
              : received.map(r => (
                <Row key={r.requestId}>
                  <Avatar name={r.senderNickname} />
                  <div style={{ flex: 1 }}>
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
                  <div style={{ flex: 1 }}>
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
