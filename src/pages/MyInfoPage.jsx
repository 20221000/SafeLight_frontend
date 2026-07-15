import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import { apiGet, apiSend } from '../utils/adminApi'

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
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [alarmSound, setAlarmSound] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // 신고 신뢰도: GET /users/fake(허위신고 횟수) + GET /users/black(블랙리스트 여부)
  const [reportStats, setReportStats] = useState({ fakeReports: 0, blacklisted: false })

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      const [fake, black] = await Promise.all([
        apiGet('/users/fake').catch(() => null),
        apiGet('/users/black').catch(() => null),
      ])
      if (!alive) return
      setReportStats({
        fakeReports: fake?.falseReportCount ?? 0,
        blacklisted: black?.isBlacklisted ?? false,
      })
    })()
    return () => { alive = false }
  }, [user])

  const handleProfileSave = async () => {
    if (!user) { alert('로그인이 필요합니다.'); return }
    const nn = nickname.trim()
    if (!nn) { alert('변경할 닉네임을 입력해주세요.'); return }
    setSaving(true)
    try {
      // 백엔드 저장 가능한 필드는 nickname 뿐(bio·github 컬럼 미존재)
      await apiSend(`/users/${user.userId}`, 'PUT', { nickname: nn })
      onUpdateUser?.({ nickname: nn })
      setNickname('')
      alert('프로필이 저장되었습니다.')
    } catch (e) {
      alert('프로필 저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!user) { alert('로그인이 필요합니다.'); return }
    if (!currentPw || !newPw) { alert('비밀번호를 입력해주세요.'); return }
    if (newPw.length < 6) { alert('비밀번호는 6자 이상이어야 합니다.'); return }
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

  const handleCopyId = () => {
    if (user?.userId == null) return
    const text = String(user.userId)
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done)
    } else {
      done()
    }
  }

  const avatarChar = (user?.nickname || user?.username || '?').charAt(0)

  return (
    <UserShell user={user} onLogout={onLogout} active="myinfo">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px' }}>내 정보</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>계정과 안전 설정을 관리하세요</div>
        </div>

        {/* 프로필 헤더 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#1E40AF)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, flexShrink: 0,
          }}>{avatarChar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{user?.nickname || user?.username || '게스트'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>@{user?.username || '-'}</div>
          </div>
          {user?.role === 'ADMIN' && (
            <span style={{ background: 'var(--blue-tint)', color: 'var(--blue-primary)', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 20 }}>관리자</span>
          )}
          {user?.userId != null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>ID</span>
              <div
                onClick={handleCopyId}
                title="클릭하여 복사 (친구 추가 시 사용)"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  background: 'var(--blue-tint)', color: 'var(--blue-primary)', borderRadius: 10,
                  fontSize: 15, fontWeight: 800, fontFamily: "'Inter',monospace", letterSpacing: '.5px',
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                {String(user.userId).padStart(7, '0')}
                {copied ? (
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>복사됨!</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 계정 설정 */}
        <Card title="계정 설정" desc="프로필과 비밀번호를 변경할 수 있습니다.">
          <Field label="닉네임">
            <input style={inputStyle} placeholder={user?.nickname || '새 닉네임'} value={nickname} onChange={e => setNickname(e.target.value)} />
          </Field>
          <button onClick={handleProfileSave} disabled={saving} style={{
            height: 44, padding: '0 20px', border: 'none', borderRadius: 11, background: 'var(--blue-primary)', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1, fontFamily: 'inherit',
          }}>{saving ? '저장 중...' : '프로필 저장'}</button>

          <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

          <Field label="현재 비밀번호">
            <input style={inputStyle} type="password" placeholder="현재 비밀번호" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          </Field>
          <Field label="새 비밀번호">
            <input style={inputStyle} type="password" placeholder="새 비밀번호 (6자 이상)" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </Field>
          <button onClick={handlePasswordChange} style={{
            height: 44, padding: '0 20px', border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)',
            color: 'var(--text-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>비밀번호 변경</button>
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
