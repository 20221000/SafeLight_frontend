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
  { name: 'password', label: '비밀번호', type: 'password', placeholder: '6자 이상', icon: lockIcon },
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
    if (form.password.length < 6) return '비밀번호는 6자 이상이어야 합니다.'
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
      setTimeout(() => onGoLogin(), 1500)
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout modal={modal} onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '20px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'rgba(16,185,129,.13)', color: 'var(--safe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>회원가입 완료!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>로그인 화면으로 이동합니다...</div>
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
