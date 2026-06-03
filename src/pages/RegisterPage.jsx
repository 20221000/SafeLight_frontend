import { useState } from 'react'

export default function RegisterPage({ onGoLogin, onClose }) {
  const [form, setForm] = useState({
    username: '', nickname: '', email: '', password: '', passwordConfirm: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const validate = () => {
    if (!form.username || !form.nickname || !form.email || !form.password)
      return '모든 항목을 입력해주세요.'
    if (form.password !== form.passwordConfirm)
      return '비밀번호가 일치하지 않습니다.'
    if (form.password.length < 6)
      return '비밀번호는 6자 이상이어야 합니다.'
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
        body: JSON.stringify({
          username: form.username,
          nickname: form.nickname,
          email: form.email,
          password: form.password,
        }),
      })

      const json = await res.json()

      if (!json.success) {
        setError(json.error?.message || '회원가입에 실패했습니다.')
        return
      }

      setSuccess(true)
      setTimeout(() => onGoLogin(), 1500)

    } catch (err) {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const s = styles

  if (success) {
    return (
      <div style={s.bg}>
        <div style={{ ...s.card, alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '48px' }}>✅</span>
          <p style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>
            회원가입 완료!
          </p>
          <p style={{ color: '#A0AEC0', fontSize: '13px' }}>
            로그인 화면으로 이동합니다...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={s.bg}>
      <div style={s.card}>

        <button style={s.closeBtn} onClick={onClose}>✕</button>

        <div style={s.logoRow}>
          <span style={{ fontSize: '24px' }}>🛡️</span>
          <span style={s.logoText}>Light Safe</span>
        </div>
        <p style={s.sub}>새 계정을 만들어주세요</p>

        {[
          { name: 'username',        label: '아이디',        type: 'text',     placeholder: '영문, 숫자 조합' },
          { name: 'nickname',        label: '닉네임',        type: 'text',     placeholder: '사용할 닉네임' },
          { name: 'email',           label: '이메일',        type: 'email',    placeholder: 'example@email.com' },
          { name: 'password',        label: '비밀번호',      type: 'password', placeholder: '6자 이상' },
          { name: 'passwordConfirm', label: '비밀번호 확인', type: 'password', placeholder: '비밀번호 재입력' },
        ].map(field => (
          <div key={field.name} style={s.field}>
            <label style={s.label}>{field.label}</label>
            <input
              style={s.input}
              name={field.name}
              type={field.type}
              placeholder={field.placeholder}
              value={form[field.name]}
              onChange={handleChange}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        ))}

        {error && <p style={s.error}>{error}</p>}

        <button
          style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '처리 중...' : '회원가입'}
        </button>

        <button style={s.subBtn} onClick={onGoLogin}>
          이미 계정이 있으신가요? 로그인
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
    overflowY: 'auto',
  },
  card: {
    width: '400px',
    backgroundColor: '#161B27',
    borderRadius: '16px',
    padding: '36px 36px',
    border: '1px solid #1E2535',
    display: 'flex', flexDirection: 'column',
    position: 'relative',
    margin: '24px 0',
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
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px',
  },
  logoText: { color: '#fff', fontSize: '20px', fontWeight: '700' },
  sub: { color: '#A0AEC0', fontSize: '13px', marginBottom: '24px' },
  field: { marginBottom: '14px' },
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
  error: { color: '#FF3B3B', fontSize: '12px', marginBottom: '10px' },
  btn: {
    width: '100%', backgroundColor: '#00E676',
    border: 'none', borderRadius: '8px',
    padding: '13px 0', color: '#000',
    fontWeight: '700', fontSize: '15px', cursor: 'pointer',
    marginTop: '4px', marginBottom: '12px',
  },
  subBtn: {
    width: '100%', backgroundColor: 'transparent',
    border: 'none', color: '#00E676',
    fontSize: '13px', cursor: 'pointer', padding: '8px 0',
  },
}