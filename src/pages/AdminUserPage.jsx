import { useState, useEffect, useCallback } from 'react'
import AdminShell from '../components/layout/AdminShell'
import { adminStyles as s } from '../components/Admin/adminStyles'
import { apiGet, apiSend } from '../utils/adminApi'

const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '-')

export default function AdminUserPage({ user, onLogout }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nickname: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user || user.role !== 'ADMIN') return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet('/users')
      setUsers(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const openEdit = (u) => {
    setEditing(u)
    setForm({ nickname: u.nickname ?? '', email: u.email ?? '', phone: u.phone ?? '' })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await apiSend(`/users/${editing.userId}`, 'PUT', {
        nickname: form.nickname,
        email: form.email,
        phone: form.phone,
      })
      setEditing(null)
      await load()
    } catch (e) {
      alert('수정 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`'${u.nickname}' 사용자를 삭제할까요? 되돌릴 수 없습니다.`)) return
    try {
      await apiSend(`/users/${u.userId}`, 'DELETE')
      await load()
    } catch (e) {
      alert('삭제 실패: ' + e.message)
    }
  }

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [u.nickname, u.username, u.email, u.phone]
      .some(v => String(v ?? '').toLowerCase().includes(q))
  })

  return (
    <AdminShell user={user} onLogout={onLogout} active="users" title="사용자 관리" subtitle="가입 사용자와 블랙리스트를 관리합니다">
      {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <input
          style={s.searchInput}
          placeholder="닉네임 / 아이디 / 이메일 / 전화 검색…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>총 {filtered.length}명</span>
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>{['ID', '닉네임', '아이디', '이메일', '전화', '허위신고', '권한', '상태', '가입일', '관리'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(u => (
              <tr key={u.userId} style={s.tr}>
                <td style={s.td}>#{u.userId}</td>
                <td style={s.td}>{u.nickname}</td>
                <td style={s.td}>{u.username}</td>
                <td style={s.td}>{u.email ?? '-'}</td>
                <td style={s.td}>{u.phone ?? '-'}</td>
                <td style={{ ...s.td, color: (u.falseReportCount ?? 0) >= 2 ? 'var(--danger)' : 'var(--text-strong)', fontWeight: (u.falseReportCount ?? 0) >= 2 ? '700' : '400' }}>
                  {u.falseReportCount ?? 0}회
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: u.role === 'ADMIN' ? 'var(--blue-tint)' : 'rgba(100,116,139,.12)', color: u.role === 'ADMIN' ? 'var(--blue-primary)' : 'var(--text-muted)' }}>
                    {u.role}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: u.isBlacklisted ? 'rgba(225,29,72,.10)' : 'rgba(16,185,129,.13)', color: u.isBlacklisted ? 'var(--danger)' : 'var(--safe)' }}>
                    {u.isBlacklisted ? '블랙리스트' : '정상'}
                  </span>
                </td>
                <td style={s.td}>{fmtDate(u.createdAt)}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={s.btnMint} onClick={() => openEdit(u)}>수정</button>
                    <button style={s.btnRed} onClick={() => handleDelete(u)} disabled={u.role === 'ADMIN'}>삭제</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={10} style={s.emptyRow}>{loading ? '불러오는 중…' : '사용자가 없습니다.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={s.modalOverlay} onClick={() => setEditing(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>사용자 수정 · #{editing.userId} {editing.username}</div>
            <div style={s.modalRow}>
              <label style={s.inputLabel}>닉네임</label>
              <input style={s.input} value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
            </div>
            <div style={s.modalRow}>
              <label style={s.inputLabel}>이메일</label>
              <input style={s.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={s.modalRow}>
              <label style={s.inputLabel}>전화번호 (010-1234-5678)</label>
              <input style={s.input} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div style={s.modalActions}>
              <button style={s.btnGray} onClick={() => setEditing(null)}>취소</button>
              <button style={s.btnMint} onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
