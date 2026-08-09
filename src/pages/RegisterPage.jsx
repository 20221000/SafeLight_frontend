import { useState } from 'react'
import AuthLayout, { AuthLogo, AuthField } from '../components/layout/AuthLayout'
import { readEnvelope } from '../utils/apiResponse'

const userIcon = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
const tagIcon = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" /></svg>
const mailIcon = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
const lockIcon = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>

const FIELDS = [
  { name: 'username', label: '아이디', type: 'text', placeholder: '영문, 숫자 조합', icon: userIcon },
  { name: 'nickname', label: '닉네임', type: 'text', placeholder: '사용할 닉네임', icon: tagIcon },
  { name: 'email', label: '이메일', type: 'email', placeholder: 'example@email.com', icon: mailIcon },
  { name: 'password', label: '비밀번호', type: 'password', placeholder: '8자 이상', icon: lockIcon },
  { name: 'passwordConfirm', label: '비밀번호 확인', type: 'password', placeholder: '비밀번호 재입력', icon: lockIcon },
]

export default function RegisterPage({ onGoLogin, modal = false, onClose }) {
  const [form, setForm] = useState({ username: '', nickname: '', email: '', password: '', passwordConfirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const validate = () => {
    if (!form.username || !form.nickname || !form.email || !form.password) return '모든 항목을 입력해주세요.'
    if (form.password !== form.passwordConfirm) return '비밀번호가 일치하지 않습니다.'
    // 백엔드 @Size(min = 8, max = 72) 와 맞춰둔다. 어긋나면 서버가 400으로 되돌린다.
    if (form.password.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
    if (form.password.length > 72) return '비밀번호는 72자 이하여야 합니다.'
    return ''
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, nickname: form.nickname, email: form.email, password: form.password }),
      })
      const json = await readEnvelope(res)
      if (!json.success) {
        setError(json.error?.message || json.message || '회원가입에 실패했습니다.')
        return
      }
      setSuccess(true)
      // 1.5초는 만들어진 계정을 훑기에도 짧았다. 읽을 내용을 늘린 만큼 3초로 두고,
      // 대신 남은 시간을 막대로 보여주고 '로그인하러 가기'로 언제든 건너뛸 수 있게 했다.
      // 아래 완료 화면의 진행 막대와 같은 3초다 — 한쪽을 바꾸면 다른 쪽도 바꿔야 한다.
      setTimeout(() => onGoLogin(), 3000)
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    // 예전 완료 화면은 420px 카드 한가운데에 아이콘·제목·한 줄만 떠 있어서
    // 카드 대부분이 빈 채로 남았다(= 붕 뜬 느낌의 원인). 세 가지로 채운다:
    //   1) 로고를 그대로 둬서 입력 화면에서 이어지는 같은 카드로 읽히게 하고,
    //   2) 방금 만들어진 계정을 실제로 보여주고(폼과 같은 --bg + 테두리 언어),
    //   3) 자동 이동을 기다리게 두지 않고 버튼으로 건너뛸 수 있게 한다.
    return (
      <AuthLayout modal={modal} onClose={onClose}>
        <AuthLogo subtitle="가입이 완료되었습니다" />

        <div style={{
          border: '1px solid var(--border)', borderRadius: 14, background: 'var(--bg)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 16px' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: 'var(--safe)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>계정이 만들어졌습니다</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>이제 이 아이디로 로그인할 수 있습니다</div>
            </div>
          </div>

          {/* 무엇이 만들어졌는지 눈으로 확인시킨다. 오타를 여기서 알아채면 다시 가입하면 된다. */}
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '4px 16px' }}>
            {[
              { label: '아이디', value: form.username },
              { label: '닉네임', value: form.nickname },
              { label: '이메일', value: form.email },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', width: 52, flexShrink: 0 }}>{row.label}</span>
                {/* minWidth:0 — 긴 이메일이 칸을 넘치지 않게. */}
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onGoLogin}
          style={{
            width: '100%', height: 50, marginTop: 18, border: 'none', borderRadius: 13,
            background: 'var(--blue-primary)', color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >로그인하러 가기</button>

        {/* 자동 이동까지 남은 시간. 예전엔 '이동합니다...' 뿐이라 언제 넘어갈지 알 수 없었다. */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 7 }}>
            잠시 후 로그인 화면으로 이동합니다
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'var(--blue-primary)', transformOrigin: 'left',
              animation: 'ls-timebar 3s linear forwards',
            }} />
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout modal={modal} onClose={onClose}>
      <AuthLogo subtitle="새 계정을 만들어주세요" />

      {FIELDS.map(f => (
        <AuthField
          key={f.name}
          label={f.label}
          name={f.name}
          type={f.type}
          placeholder={f.placeholder}
          icon={f.icon}
          value={form[f.name]}
          onChange={handleChange}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
      ))}

      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12, marginTop: -6 }}>{error}</div>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: '100%', height: 50, border: 'none', borderRadius: 13, background: 'var(--blue-primary)', color: '#fff',
          fontSize: 15.5, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1,
          boxShadow: '0 8px 20px rgba(37,99,235,.3)', fontFamily: 'inherit', marginTop: 4,
        }}
      >
        {loading ? '처리 중...' : '회원가입'}
      </button>

      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 18 }}>
        이미 계정이 있으신가요?{' '}
        <span onClick={onGoLogin} style={{ color: 'var(--blue-primary)', fontWeight: 600, cursor: 'pointer' }}>로그인</span>
      </div>
    </AuthLayout>
  )
}
