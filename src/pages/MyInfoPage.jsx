import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import useIsMobile from '../hooks/useIsMobile'
import useAuthNav from '../hooks/useAuthNav'
import { apiGet, apiSend } from '../utils/adminApi'
import { POST_CATEGORY } from '../theme/tokens'

// 긴급 신고 상태 배지 스타일. 백엔드 EmergencyReportStatus 는 RECEIVED/RESOLVED/FALSE 뿐이고
// 허위 여부는 isFalseReport 로 따로 온다.
const REPORT_STATUS = {
  RECEIVED: { label: '접수', color: 'var(--blue-primary)', bg: 'var(--blue-tint)' },
  RESOLVED: { label: '완료', color: 'var(--safe)',         bg: 'rgba(16,185,129,.13)' },
  FALSE:    { label: '오탐', color: 'var(--text-muted)',   bg: 'rgba(100,116,139,.12)' },
}

// UserService.updateProfile 의 정규식과 동일하게 맞춘다. 어긋나면 서버가 400/409로 되돌린다.
const EMAIL_RE = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const PHONE_RE = /^010-\d{4}-\d{4}$/

// 숫자만 입력해도 010-1234-5678 로 맞춰준다 (백엔드 형식이 엄격하다)
const formatPhone = (value) => {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

// 신고가 속한 위험구역의 등급 (EmergencyReportResponse.dangerLevel)
const DANGER_LEVEL = {
  HIGH:   { label: '위험', color: 'var(--danger)',  bg: 'rgba(225,29,72,.10)' },
  MEDIUM: { label: '주의', color: 'var(--warning)', bg: 'rgba(245,158,11,.13)' },
  LOW:    { label: '관심', color: 'var(--safe)',    bg: 'rgba(16,185,129,.13)' },
}

function Card({ title, desc, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }}>
      <div style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{desc}</div>}
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', height: 44, padding: '0 14px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 11, fontSize: 14, color: 'var(--text-strong)', outline: 'none', fontFamily: 'inherit',
}

// 읽기 전용일 때는 입력칸처럼 보이지 않게 테두리를 죽이고 글자를 흐리게 둔다.
const readableInput = (editable) => (editable ? inputStyle : {
  ...inputStyle,
  background: 'transparent',
  borderColor: 'transparent',
  color: 'var(--text-muted)',
  padding: '0 2px',
  cursor: 'default',
})

// 카드 하단 버튼 줄 — 우측 정렬
const actionRow = { display: 'flex', justifyContent: 'flex-end', gap: 8 }

const primaryBtn = {
  height: 44, padding: '0 20px', border: 'none', borderRadius: 11, background: 'var(--blue-primary)', color: '#fff',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

const secondaryBtn = {
  height: 44, padding: '0 20px', border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)',
  color: 'var(--text-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

const headerIconBtn = (extra = {}) => ({
  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
  ...extra,
})

function Toggle({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{
      width: 42, height: 24, borderRadius: 12, background: checked ? 'var(--blue-primary)' : 'var(--border)',
      cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </div>
  )
}

export default function MyInfoPage({ user, onLogout, onUpdateUser }) {
  const isMobile = useIsMobile() // 모바일: 페이지 여백 축소(데스크탑 48/30px는 375px에서 너무 넓다)
  const navigate = useNavigate()
  const location = useLocation()
  const { goLogin } = useAuthNav()
  // 계정 설정 입력값. profile 을 받으면 현재 값으로 한 번 채우고, 저장 시 바뀐 필드만 보낸다.
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  // 기본은 읽기 전용. '프로필 수정'을 눌러야 입력칸이 열리고 버튼이 '프로필 저장'으로 바뀐다.
  const [editingProfile, setEditingProfile] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [alarmSound, setAlarmSound] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  // 프로필: GET /users/{userId} — 이메일·전화·가입일에 더해 falseReportCount·isBlacklisted 까지 한 번에 준다.
  // (전용 엔드포인트 /users/fake·/users/black 를 따로 부르던 걸 이걸로 합쳤다. 로그인 당시
  //  localStorage 에 넣어둔 값과 달리 서버의 현재 값이라 관리자가 바꾼 상태도 반영된다)
  const [profile, setProfile] = useState(null)
  const [reportStats, setReportStats] = useState({ fakeReports: 0, blacklisted: false })
  // 내 활동: GET /users/my/posts(내가 쓴 글) + GET /emergency-reports/my(내 신고 내역)
  //
  // /users/my/reports 도 같은 목록을 주지만(리포지토리 메서드가 동일) 응답이 5개 필드로 줄어 있다.
  // /emergency-reports/my 는 좌표·위험도·인근 CCTV까지 주는 상위 집합이라 이쪽을 쓴다.
  const [myPosts, setMyPosts] = useState([])
  const [myReports, setMyReports] = useState([])
  // 안 읽은 쪽지 개수: GET /messages/unread-count → { unreadCount }
  const [unreadMessages, setUnreadMessages] = useState(0)
  // 안 읽은 알림 개수: GET /notifications/unread-count → { unreadCount }
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  // 비로그인으로 '내 정보'에 들어오면 볼 게 없다 — 이름은 '게스트', 아래 값은 전부 '-' 인 빈 껍데기다.
  // 그 화면에 머물게 두지 않고 마운트 시 한 번 로그인으로 넘긴다. 한 줄로 두 화면이 갈린다:
  //   데스크탑 — backgroundLocation 을 실어 보내므로 App 이 이 화면을 뒤에 남긴 채 로그인 카드만 띄운다.
  //   모바일   — App 이 좁은 화면에서는 backgroundLocation 을 무시한다(뒤 페이지가 화면을 다 채워
  //              카드가 스크롤 밖으로 밀리기 때문) → 로그인 전체 화면으로 전환된다.
  //
  // replace 인 이유: 이 빈 화면을 히스토리에 남기면 로그인을 닫거나 뒤로 갔을 때 다시 여기로 돌아온다.
  // 의존성이 빈 배열인 이유: 데스크탑에서는 모달이 떠 있는 동안에도 이 페이지가 배경으로 계속
  // 마운트돼 있다. user 를 넣으면 로그인 성공 직후 한 번 더 /login 으로 튈 여지가 생긴다.
  useEffect(() => {
    if (user) return
    navigate('/login', { replace: true, state: { backgroundLocation: location } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      const [prof, posts, reports, unread, unreadNoti] = await Promise.all([
        apiGet(`/users/${user.userId}`).catch(() => null),
        apiGet('/users/my/posts').catch(() => []),
        apiGet('/emergency-reports/my').catch(() => []),
        apiGet('/messages/unread-count').catch(() => null),
        apiGet('/notifications/unread-count').catch(() => null),
      ])
      if (!alive) return
      setProfile(prof)
      setReportStats({
        fakeReports: prof?.falseReportCount ?? 0,
        blacklisted: prof?.isBlacklisted ?? false,
      })
      setMyPosts(Array.isArray(posts) ? posts : [])
      setMyReports(Array.isArray(reports) ? reports : [])
      setUnreadMessages(unread?.unreadCount ?? 0)
      setUnreadNotifications(unreadNoti?.unreadCount ?? 0)
      if (prof) {
        setNickname(prof.nickname ?? '')
        setEmail(prof.email ?? '')
        setPhone(prof.phone ?? '')
      }
    })()
    return () => { alive = false }
  }, [user])

  // 수정을 접고 서버에서 받은 값으로 되돌린다.
  const cancelProfileEdit = () => {
    setNickname(profile?.nickname ?? '')
    setEmail(profile?.email ?? '')
    setPhone(profile?.phone ?? '')
    setEditingProfile(false)
  }

  const handleProfileSave = async () => {
    if (!user) { alert('로그인이 필요합니다.'); return }

    const nn = nickname.trim()
    const em = email.trim().toLowerCase()
    const ph = phone.trim()

    if (!nn) { alert('닉네임은 비워둘 수 없습니다.'); return }
    if (nn.length > 50) { alert('닉네임은 50자 이하여야 합니다.'); return }
    if (em && !EMAIL_RE.test(em)) { alert('올바른 이메일 형식이 아닙니다.'); return }
    if (em.length > 100) { alert('이메일은 100자 이하여야 합니다.'); return }
    if (ph && !PHONE_RE.test(ph)) { alert('전화번호는 010-1234-5678 형식으로 입력해주세요.'); return }

    // 백엔드는 빈 값이면 해당 필드를 건너뛴다. 바뀐 것만 보내야 불필요한 중복검사·에러를 피한다.
    const patch = {}
    if (nn !== (profile?.nickname ?? '')) patch.nickname = nn
    if (em && em !== (profile?.email ?? '')) patch.email = em
    if (ph && ph !== (profile?.phone ?? '')) patch.phone = ph

    if (Object.keys(patch).length === 0) { setEditingProfile(false); return }

    setSaving(true)
    try {
      // 응답으로 { userId, nickname, email, phone } 이 돌아온다.
      const saved = await apiSend(`/users/${user.userId}`, 'PUT', patch)
      if (patch.nickname) onUpdateUser?.({ nickname: patch.nickname })
      // 헤더는 profile 을 먼저 보므로 여기도 같이 갱신해야 저장이 바로 보인다.
      setProfile(prev => (prev ? { ...prev, ...patch } : prev))
      setNickname(saved?.nickname ?? nn)
      setEmail(saved?.email ?? em)
      setPhone(saved?.phone ?? ph)
      setEditingProfile(false) // 저장이 끝나면 다시 잠근다
      alert('프로필이 저장되었습니다.')
    } catch (e) {
      // 이메일 중복(409)·형식 오류(400) 문구가 그대로 올라온다.
      alert('프로필 저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!user) { alert('로그인이 필요합니다.'); return }
    if (!currentPw || !newPw) { alert('비밀번호를 입력해주세요.'); return }
    // 회원가입(@Size(min=8))과 규칙을 맞춘다. 변경 API에는 검증 애너테이션이 없어 프론트에서 막는다.
    if (newPw.length < 8) { alert('비밀번호는 8자 이상이어야 합니다.'); return }
    try {
      await apiSend(`/users/${user.userId}`, 'PUT', { password: newPw })
      alert('비밀번호가 변경되었습니다.')
      setCurrentPw(''); setNewPw('')
    } catch (e) {
      alert('비밀번호 변경 실패: ' + e.message)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    try {
      await apiSend(`/users/${user.userId}`, 'DELETE')
      alert('회원 탈퇴가 완료되었습니다.')
      onLogout()
      navigate('/')
    } catch (e) {
      alert('회원 탈퇴 실패: ' + e.message)
    }
  }

  // 서버 값(profile)을 우선한다. localStorage 의 user 는 로그인 시점 스냅샷이라
  // 다른 기기에서 바꿨거나 관리자가 손댄 닉네임이 반영되지 않는다.
  const displayName = profile?.nickname || user?.nickname || user?.username || '게스트'
  const avatarChar = (displayName === '게스트' ? '?' : displayName).charAt(0)

  return (
    <UserShell user={user} onLogout={onLogout} active="myinfo">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 16px 24px' : '26px 48px', display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px' }}>내 정보</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>계정과 안전 설정을 관리하세요</div>
          </div>
          {/* 모바일 전용: 좁은 헤더에서 뺀 관리자 전환·로그인/로그아웃을 제목 우측 여백에 둔다.
              데스크탑은 IconRail이 이미 담당하므로 중복 노출하지 않는다. 아이콘은 IconRail과 동일. */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {user?.role === 'ADMIN' && (
                <button onClick={() => navigate('/admin')} title="관리자 콘솔" aria-label="관리자 콘솔" style={headerIconBtn()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
                </button>
              )}
              {user ? (
                <button onClick={onLogout} title="로그아웃" aria-label="로그아웃" style={headerIconBtn()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
                </button>
              ) : (
                <button onClick={goLogin} title="로그인" aria-label="로그인" style={headerIconBtn({ color: 'var(--blue-primary)' })}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9" /></svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 프로필 헤더 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#1E40AF)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, flexShrink: 0,
          }}>{avatarChar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{user?.username || '-'}</div>
            {/* 이메일·전화번호는 아래 '계정 설정'에서 보고 고치므로 여기서는 가입일만 둔다 */}
            {profile?.createdAt && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                가입 {String(profile.createdAt).slice(0, 10)}
              </div>
            )}
          </div>
          {/* 관리자 배지는 숫자 ID가 있던 우측 자리로 (닉네임 위에 겹치지 않도록 flexShrink:0) */}
          {user?.role === 'ADMIN' && (
            <span style={{ flexShrink: 0, background: 'var(--blue-tint)', color: 'var(--blue-primary)', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 20 }}>관리자</span>
          )}
        </div>

        {/* 계정 설정 */}
        <Card title="계정 설정" desc="프로필과 비밀번호를 변경할 수 있습니다.">
          {/* 수정 모드가 아니면 세 칸 모두 잠겨 있다 */}
          <Field label="닉네임">
            <input style={readableInput(editingProfile)} disabled={!editingProfile} placeholder="닉네임" value={nickname} onChange={e => setNickname(e.target.value)} />
          </Field>
          <Field label="이메일">
            <input style={readableInput(editingProfile)} disabled={!editingProfile} type="email" inputMode="email" autoComplete="email" placeholder="등록된 이메일 없음" value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label="전화번호">
            {/* 백엔드가 010-1234-5678 형식만 받아서 입력하는 대로 하이픈을 넣어준다 */}
            <input style={readableInput(editingProfile)} disabled={!editingProfile} type="tel" inputMode="numeric" autoComplete="tel" placeholder="등록된 전화번호 없음" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} />
          </Field>
          <div style={actionRow}>
            {editingProfile && (
              <button onClick={cancelProfileEdit} disabled={saving} style={{ ...secondaryBtn, opacity: saving ? .6 : 1 }}>취소</button>
            )}
            <button
              onClick={editingProfile ? handleProfileSave : () => setEditingProfile(true)}
              disabled={saving}
              style={{ ...primaryBtn, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}
            >{saving ? '저장 중...' : editingProfile ? '프로필 저장' : '프로필 수정'}</button>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

          <Field label="현재 비밀번호">
            <input style={inputStyle} type="password" placeholder="현재 비밀번호" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          </Field>
          <Field label="새 비밀번호">
            <input style={inputStyle} type="password" placeholder="새 비밀번호 (8자 이상)" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </Field>
          <div style={actionRow}>
            <button onClick={handlePasswordChange} style={secondaryBtn}>비밀번호 변경</button>
          </div>
        </Card>

        {/* 알림 — 친구의 긴급신고(SOS). 상단바 벨과 같은 곳으로 간다. */}
        <Card title="알림" desc="친구의 긴급 상황 알림을 확인합니다.">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer' }} onClick={() => navigate('/myinfo/notifications')}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>알림함</span>
                {unreadNotifications > 0 && (
                  <span style={{
                    fontFamily: "'Inter',sans-serif", background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700,
                    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{unreadNotifications}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {unreadNotifications > 0 ? `읽지 않은 알림이 ${unreadNotifications}개 있습니다.` : '읽지 않은 알림이 없습니다.'}
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </div>
        </Card>

        {/* 쪽지함 — 친구끼리 주고받는 쪽지 (백엔드가 친구에게만 발송을 허용한다) */}
        <Card title="쪽지" desc="친구와 주고받은 쪽지를 확인합니다.">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer' }} onClick={() => navigate('/myinfo/messages')}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>쪽지함</span>
                {unreadMessages > 0 && (
                  <span style={{
                    fontFamily: "'Inter',sans-serif", background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700,
                    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{unreadMessages}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {unreadMessages > 0 ? `읽지 않은 쪽지가 ${unreadMessages}개 있습니다.` : '읽지 않은 쪽지가 없습니다.'}
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </div>
        </Card>

        {/* 안전 설정 */}
        <Card title="안전 설정" desc="긴급 상황 관련 설정입니다.">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 10, cursor: 'pointer' }} onClick={() => navigate('/myinfo/friends')}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>긴급 위치 공유 친구 관리</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>긴급 신고 시 내 위치를 공유할 친구를 지정합니다.</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>긴급 알람 소리</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>긴급 신고 접수 시 사이렌을 재생합니다.</div>
            </div>
            <Toggle checked={alarmSound} onChange={() => setAlarmSound(v => !v)} />
          </div>
        </Card>

        {/* 내가 쓴 글 (안전 설정 아래, 신고 신뢰도 위) */}
        <Card title="내가 쓴 글" desc={myPosts.length > 0 ? `총 ${myPosts.length}개의 게시글을 작성했습니다.` : '커뮤니티에 작성한 글이 여기에 표시됩니다.'}>
          {myPosts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myPosts.map(post => {
                const c = POST_CATEGORY[post.category] ?? POST_CATEGORY.INFO
                return (
                  <div key={post.postId} onClick={() => navigate(`/community/${post.postId}`)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer',
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                  }}>
                    <span style={{ flexShrink: 0, background: c.bg, color: c.color, fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap' }}>{c.label}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                    <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{String(post.createdAt ?? '').slice(0, 10)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 0' }}>아직 작성한 글이 없습니다.</div>
          )}
        </Card>

        {/* 내 신고 내역 */}
        <Card title="내 신고 내역" desc={myReports.length > 0 ? `총 ${myReports.length}건의 긴급 신고 내역이 있습니다.` : '내가 접수한 긴급 신고가 여기에 표시됩니다.'}>
          {myReports.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myReports.map(rep => {
                const s = rep.isFalseReport
                  ? { label: '허위', color: 'var(--danger)', bg: 'rgba(225,29,72,.10)' }
                  : (REPORT_STATUS[rep.reportStatus] ?? REPORT_STATUS.RECEIVED)
                const lv = DANGER_LEVEL[rep.dangerLevel]
                const cctvName = rep.nearestCctv?.cctvName
                return (
                  <div key={rep.reportId} style={{
                    padding: '11px 14px',
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flexShrink: 0, background: s.bg, color: s.color, fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap' }}>{s.label}</span>
                      {lv && (
                        <span style={{ flexShrink: 0, background: lv.bg, color: lv.color, fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap' }}>{lv.label}</span>
                      )}
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rep.description || '긴급 신고'}</span>
                      <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{String(rep.reportedAt ?? '').slice(0, 10)}</span>
                    </div>
                    {rep.latitude != null && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: "'Inter',sans-serif" }}>
                          {Number(rep.latitude).toFixed(5)}, {Number(rep.longitude).toFixed(5)}
                        </span>
                        {cctvName ? ` · 인근 CCTV ${cctvName}` : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 0' }}>아직 신고 내역이 없습니다.</div>
          )}
        </Card>

        {/* 신고 신뢰도 */}
        <Card title="신고 신뢰도" desc="허위 긴급신고가 누적되면 서비스 이용이 제한될 수 있습니다.">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>허위신고 횟수</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Inter',sans-serif", color: reportStats.fakeReports > 0 ? 'var(--danger)' : 'var(--text-strong)' }}>{reportStats.fakeReports} / 3</div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>계정 상태</div>
              <span style={{
                display: 'inline-block', marginTop: 2, padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                background: reportStats.blacklisted ? 'rgba(225,29,72,.10)' : 'rgba(16,185,129,.13)',
                color: reportStats.blacklisted ? 'var(--danger)' : 'var(--safe)',
              }}>{reportStats.blacklisted ? '블랙리스트' : '정상'}</span>
            </div>
          </div>
        </Card>

        {/* 회원 탈퇴 */}
        <Card title="계정 관리">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>탈퇴 시 모든 정보가 삭제되며 복구할 수 없습니다.</span>
            <button onClick={() => setShowDelete(true)} style={{
              height: 42, padding: '0 18px', border: '1px solid var(--danger)', borderRadius: 11, background: 'var(--surface)',
              color: 'var(--danger)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>회원 탈퇴</button>
          </div>
        </Card>
      </div>

      {/* 탈퇴 확인 모달 */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 340, background: 'var(--surface)', borderRadius: 18, padding: 28, textAlign: 'center', boxShadow: '0 20px 50px rgba(15,23,42,.25)' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 14px', borderRadius: 15, background: 'rgba(225,29,72,.10)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>정말 탈퇴하시겠습니까?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>탈퇴 시 모든 정보가 삭제되며<br />복구할 수 없습니다.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setShowDelete(false)} style={{ flex: 1, height: 46, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleDeleteAccount} style={{ flex: 1, height: 46, border: 'none', borderRadius: 12, background: 'var(--danger)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>탈퇴하기</button>
            </div>
          </div>
        </div>
      )}
    </UserShell>
  )
}
