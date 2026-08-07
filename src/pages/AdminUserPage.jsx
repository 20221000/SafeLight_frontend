import { useState, useEffect, useCallback } from 'react'
import AdminShell from '../components/layout/AdminShell'
import ActionSheet from '../components/layout/ActionSheet'
import RowMenu from '../components/Admin/RowMenu'
import { adminStyles as s } from '../components/Admin/adminStyles'
import { apiGet, apiSend } from '../utils/adminApi'
import useIsMobile from '../hooks/useIsMobile'

const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '-')

export default function AdminUserPage({ user, onLogout }) {
  const isMobile = useIsMobile()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nickname: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [riskFilter, setRiskFilter] = useState('ALL') // 모바일 칩: ALL | FALSE3 | BLACK
  const [sheetUser, setSheetUser] = useState(null)    // 모바일 '관리' 액션 시트 대상

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

  // 백엔드는 관리자가 자기 자신의 역할·블랙리스트를 바꾸는 것을 막는다(SecurityException).
  const isSelf = (u) => String(u.userId) === String(user?.userId)

  const changeStatus = async (u, patch, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    try {
      const res = await apiSend(`/admin/users/${u.userId}/status`, 'PATCH', patch)
      // 역할 변경은 대상자가 다시 로그인해야 JWT에 반영된다.
      if (res?.requiresRelogin) {
        alert('역할을 변경했습니다. 해당 사용자가 다시 로그인해야 권한이 적용됩니다.')
      }
      await load()
    } catch (e) {
      alert('상태 변경 실패: ' + e.message)
    }
  }

  const toggleBlacklist = (u) => changeStatus(
    u,
    { isBlacklisted: !u.isBlacklisted },
    u.isBlacklisted
      ? `'${u.nickname}' 의 블랙리스트를 해제할까요?`
      : `'${u.nickname}' 을(를) 블랙리스트에 등록할까요?`,
  )

  const changeRole = (u, role) => {
    if (role === u.role) return
    changeStatus(u, { role }, `'${u.nickname}' 의 권한을 ${role} 로 변경할까요?`)
  }

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [u.nickname, u.username, u.email, u.phone]
      .some(v => String(v ?? '').toLowerCase().includes(q))
  })

  // 수정 모달은 데스크탑/모바일 공용 (모바일에서도 90vw로 들어간다)
  const editModal = editing && (

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
  )

  // 모바일(AM3): 테이블 대신 회원 카드 리스트 + 위험도 칩 + '관리' 액션 시트.
  // 블랙 지정/해제와 권한 변경은 PATCH /admin/users/{id}/status 로 처리한다(자기 자신은 백엔드가 막는다).
  if (isMobile) {
    const isRisky = u => (u.falseReportCount ?? 0) >= 3
    const chips = [
      { code: 'ALL', label: '전체', count: filtered.length },
      { code: 'FALSE3', label: '허위 3회↑', count: filtered.filter(isRisky).length },
      { code: 'BLACK', label: '블랙리스트', count: filtered.filter(u => u.isBlacklisted).length },
    ]
    const list = filtered.filter(u => (
      riskFilter === 'ALL' || (riskFilter === 'FALSE3' ? isRisky(u) : u.isBlacklisted)
    ))

    return (
      <AdminShell user={user} onLogout={onLogout} active="users" title="사용자 관리" subtitle="가입 회원 · 신고 신뢰도">
        {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

        <input
          style={{ ...s.searchInput, maxWidth: '100%' }}
          placeholder="닉네임 · 아이디 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* 안 들어가면 다음 줄로 내린다. 가로 스크롤은 쓰지 않는다
            (스크롤바가 없으면 화면 밖 칩을 발견할 방법이 없다). */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {chips.map(c => {
            const on = riskFilter === c.code
            return (
              <button
                key={c.code}
                onClick={() => setRiskFilter(c.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, minHeight: 34, padding: '0 13px',
                  borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  border: `1px solid ${on ? 'var(--blue-primary)' : 'var(--border)'}`,
                  background: on ? 'var(--blue-primary)' : 'var(--surface)',
                  color: on ? '#fff' : 'var(--text-muted)',
                }}
              >
                {c.label}
                <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 800, opacity: on ? 0.9 : 0.7 }}>{loading ? '-' : c.count}</span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? '불러오는 중…' : '사용자가 없습니다.'}
            </div>
          )}
          {list.map(u => {
            const fc = u.falseReportCount ?? 0
            const risky = fc >= 3
            const warn = fc > 0 && fc < 3
            return (
              <div key={u.userId} style={{
                background: u.isBlacklisted ? 'rgba(225,29,72,.04)' : 'var(--surface)',
                border: `1px solid ${u.isBlacklisted ? 'rgba(225,29,72,.35)' : 'var(--border)'}`,
                borderRadius: 14, padding: '13px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0, color: '#fff',
                    background: 'linear-gradient(135deg,#2563EB,#1E40AF)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700,
                  }}>{(u.nickname || u.username || '?').charAt(0)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nickname}</span>
                      <span style={{ ...s.badge, flexShrink: 0, background: u.isBlacklisted ? 'rgba(225,29,72,.10)' : 'rgba(16,185,129,.13)', color: u.isBlacklisted ? 'var(--danger)' : 'var(--safe)' }}>
                        {u.isBlacklisted ? '차단됨' : '정상'}
                      </span>
                      {u.role === 'ADMIN' && (
                        <span style={{ ...s.badge, flexShrink: 0, background: 'var(--blue-tint)', color: 'var(--blue-primary)' }}>ADMIN</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: "'Inter',sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{u.username} · #{u.userId}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>가입일</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Inter',sans-serif", marginTop: 3 }}>{fmtDate(u.createdAt)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>허위신고</div>
                    <span style={{
                      display: 'inline-block', marginTop: 3, padding: '2px 9px', borderRadius: 8,
                      fontSize: 12, fontWeight: 800, fontFamily: "'Inter',sans-serif",
                      background: risky ? 'rgba(225,29,72,.10)' : warn ? 'rgba(245,158,11,.13)' : 'rgba(100,116,139,.10)',
                      color: risky ? 'var(--danger)' : warn ? 'var(--warning)' : 'var(--text-muted)',
                    }}>{fc} / 3</span>
                  </div>
                  <button
                    onClick={() => setSheetUser(u)}
                    style={{
                      marginLeft: 'auto', minHeight: 40, padding: '0 16px', borderRadius: 11, cursor: 'pointer',
                      border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)',
                      fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    }}
                  >관리</button>
                </div>
              </div>
            )
          })}
        </div>

        {sheetUser && (
          <ActionSheet
            title={sheetUser.nickname}
            subtitle={`@${sheetUser.username} · #${sheetUser.userId}`}
            actions={[
              { label: '정보 수정', tone: 'primary', onClick: () => openEdit(sheetUser) },
              {
                label: sheetUser.isBlacklisted ? '블랙리스트 해제' : '블랙리스트 지정',
                tone: sheetUser.isBlacklisted ? 'safe' : 'danger',
                disabled: isSelf(sheetUser),
                onClick: () => toggleBlacklist(sheetUser),
              },
              {
                label: sheetUser.role === 'ADMIN' ? '일반 사용자로 변경' : '관리자로 변경',
                tone: 'default',
                disabled: isSelf(sheetUser),
                onClick: () => changeRole(sheetUser, sheetUser.role === 'ADMIN' ? 'USER' : 'ADMIN'),
              },
              { label: '사용자 삭제', tone: 'danger', disabled: sheetUser.role === 'ADMIN', onClick: () => handleDelete(sheetUser) },
            ]}
            onClose={() => setSheetUser(null)}
          />
        )}
        {editModal}
      </AdminShell>
    )
  }

  // 데스크탑 '관리' 열 드롭다운 항목. 모바일 액션 시트와 같은 4가지를 같은 순서로 둔다 —
  // 예전 데스크탑에는 권한 변경이 이 묶음에 없어서(윗줄 select 로만 됐다) 두 화면이 서로 달랐다.
  // 잠기는 항목에는 사유를 달아 둔다. 회색으로 죽어 있기만 하면 왜 안 되는지 알 길이 없다.
  const userActions = (u) => [
    { label: '정보 수정', tone: 'primary', onClick: () => openEdit(u) },
    {
      label: u.isBlacklisted ? '블랙리스트 해제' : '블랙리스트 지정',
      tone: u.isBlacklisted ? 'safe' : 'danger',
      disabled: isSelf(u),
      caption: isSelf(u) ? '본인 계정에는 쓸 수 없습니다' : undefined,
      onClick: () => toggleBlacklist(u),
    },
    {
      label: u.role === 'ADMIN' ? '일반 사용자로 변경' : '관리자로 변경',
      tone: 'default',
      disabled: isSelf(u),
      caption: isSelf(u) ? '본인 권한은 바꿀 수 없습니다' : undefined,
      onClick: () => changeRole(u, u.role === 'ADMIN' ? 'USER' : 'ADMIN'),
    },
    {
      label: '사용자 삭제',
      tone: 'danger',
      disabled: u.role === 'ADMIN',
      caption: u.role === 'ADMIN' ? '먼저 일반 사용자로 내려야 합니다' : undefined,
      onClick: () => handleDelete(u),
    },
  ]

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
                {/* 권한은 '상태'와 같은 읽기 배지다. 바꾸는 건 '관리' 메뉴 한 곳으로 모았다 —
                    전에는 여기 select 로도, 아래 버튼으로도 바꿀 수 있어 같은 일을 하는 입구가 둘이었다. */}
                <td style={s.td}>
                  <span style={{
                    ...s.badge,
                    background: u.role === 'ADMIN' ? 'var(--blue-tint)' : 'rgba(100,116,139,.12)',
                    color: u.role === 'ADMIN' ? 'var(--blue-primary)' : 'var(--text-muted)',
                  }}>{u.role}</span>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: u.isBlacklisted ? 'rgba(225,29,72,.10)' : 'rgba(16,185,129,.13)', color: u.isBlacklisted ? 'var(--danger)' : 'var(--safe)' }}>
                    {u.isBlacklisted ? '블랙리스트' : '정상'}
                  </span>
                </td>
                <td style={s.td}>{fmtDate(u.createdAt)}</td>
                <td style={s.td}>
                  <RowMenu label="관리" width={216} actions={userActions(u)} />
                </td>
              </tr>
            )) : (
              <tr><td colSpan={10} style={s.emptyRow}>{loading ? '불러오는 중…' : '사용자가 없습니다.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editModal}
    </AdminShell>
  )
}
