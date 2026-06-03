import { useState } from 'react'

export default function LoginPage({ onLogin, onGoRegister, onClose }) {
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // JWT payload 디코딩 (role 추출용)
  const decodeToken = (token) => {
    try {
      const base64 = token.split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/')
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
        body: JSON.stringify({
          usernameOrEmail: form.usernameOrEmail,
          password: form.password,
        }),
      })

      const json = await res.json()

      if (!json.success) {
        setError(json.error?.message || '로그인에 실패했습니다.')
        return
      }

      const { accessToken, userId, username } = json.data

      // 토큰에서 role 추출
      const payload = decodeToken(accessToken)
      const role = payload?.role ?? 'USER'

      // localStorage 저장
      localStorage.setItem('accessToken', accessToken)

      onLogin({ userId, username, role })

    } catch (err) {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const s = styles

  return (
    <div style={s.bg}>
      <div style={s.card}>

        <button style={s.closeBtn} onClick={onClose}>✕</button>

        <div style={s.logoRow}>
          <span style={{ fontSize: '28px' }}>🛡️</span>
          <span style={s.logoText}>Light Safe</span>
        </div>
        <p style={s.sub}>안전한 귀갓길을 안내합니다</p>

        <div style={s.field}>
          <label style={s.label}>아이디 또는 이메일</label>
          <input
            style={s.input}
            name="usernameOrEmail"
            placeholder="아이디 또는 이메일 입력"
            value={form.usernameOrEmail}
            onChange={handleChange}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>비밀번호</label>
          <input
            style={s.input}
            name="password"
            type="password"
            placeholder="비밀번호 입력"
            value={form.password}
            onChange={handleChange}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && <p style={s.error}>{error}</p>}

        <button
          style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <div style={s.divider}>
          <span style={s.dividerLine} />
          <span style={s.dividerText}>또는</span>
          <span style={s.dividerLine} />
        </div>

        <button style={s.subBtn} onClick={onGoRegister}>
          회원가입
        </button>
      </div>
    </div>
  )
}

const styles = {
  bg: {
    width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'fixed', inset: 0, zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  card: {
    width: '400px',
    backgroundColor: '#161B27',
    borderRadius: '16px',
    padding: '40px 36px',
    border: '1px solid #1E2535',
    display: 'flex', flexDirection: 'column',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: '16px', right: '16px',
    background: 'none', border: 'none',
    color: '#A0AEC0', fontSize: '18px', cursor: 'pointer',
    width: '28px', height: '28px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '6px',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px',
  },
  logoText: {
    color: '#fff', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px',
  },
  sub: { color: '#A0AEC0', fontSize: '13px', marginBottom: '28px' },
  field: { marginBottom: '16px' },
  label: {
    display: 'block', color: '#A0AEC0',
    fontSize: '12px', marginBottom: '6px', fontWeight: '500',
  },
  input: {
    width: '100%', backgroundColor: '#0D1117',
    border: '1px solid #2D3748', borderRadius: '8px',
    padding: '11px 14px', color: '#fff', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
  },
  error: {
    color: '#FF3B3B', fontSize: '12px', marginBottom: '12px', marginTop: '-4px',
  },
  btn: {
    width: '100%', backgroundColor: '#00E676',
    border: 'none', borderRadius: '8px',
    padding: '13px 0', color: '#000',
    fontWeight: '700', fontSize: '15px', cursor: 'pointer',
    marginTop: '4px',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0',
  },
  dividerLine: { flex: 1, height: '1px', backgroundColor: '#1E2535' },
  dividerText: { color: '#A0AEC0', fontSize: '12px', whiteSpace: 'nowrap' },
  subBtn: {
    width: '100%', backgroundColor: 'transparent',
    border: '1px solid #2D3748', borderRadius: '8px',
    padding: '12px 0', color: '#A0AEC0',
    fontWeight: '600', fontSize: '14px', cursor: 'pointer',
  },
}