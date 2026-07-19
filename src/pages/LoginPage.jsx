import { useState } from 'react'
import AuthLayout, { AuthLogo, AuthField } from '../components/layout/AuthLayout'
import { readEnvelope } from '../utils/apiResponse'

export default function LoginPage({ onLogin, onGoRegister, modal = false, onClose }) {
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  // JWT payload 디코딩 (role 추출용)
  const decodeToken = (token) => {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(atob(base64))
    } catch {
      return null
    }
  }

  const handleSubmit = async () => {
    if (!form.usernameOrEmail || !form.password) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: form.usernameOrEmail, password: form.password }),
      })
      const json = await readEnvelope(res)
      if (!json.success || !json.data) {
        setError(json.error?.message || json.message || '로그인에 실패했습니다.')
        return
      }
      const { accessToken, userId, username } = json.data
      const payload = decodeToken(accessToken)
      const role = payload?.role ?? 'USER'
      localStorage.setItem('accessToken', accessToken)
      onLogin({ userId, username, role })
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const onEnter = e => e.key === 'Enter' && handleSubmit()

  return (
    <AuthLayout modal={modal} onClose={onClose}>
      <AuthLogo subtitle="안전한 밤길, 로그인하고 시작하세요" />

      <AuthField
        label="아이디 또는 이메일"
        name="usernameOrEmail"
        placeholder="아이디 또는 이메일 입력"
        value={form.usernameOrEmail}
        onChange={handleChange}
        onKeyDown={onEnter}
        icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>}
      />
      <AuthField
        label="비밀번호"
        name="password"
        type="password"
        placeholder="비밀번호 입력"
        value={form.password}
        onChange={handleChange}
        onKeyDown={onEnter}
        icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>}
      />

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
        {loading ? '로그인 중...' : '로그인'}
      </button>

      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 22 }}>
        아직 계정이 없으신가요?{' '}
        <span onClick={onGoRegister} style={{ color: 'var(--blue-primary)', fontWeight: 600, cursor: 'pointer' }}>회원가입</span>
      </div>
    </AuthLayout>
  )
}
