import { useState, useEffect, useCallback, useRef } from 'react'
import AdminShell from '../components/layout/AdminShell'
import { adminStyles as s } from '../components/Admin/adminStyles'
import { apiGet, apiSend } from '../utils/adminApi'
import { readEnvelope } from '../utils/apiResponse'
import useIsMobile from '../hooks/useIsMobile'
import Icon from '../components/Icon'

const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '-')

export default function AdminNoticePage({ user, onLogout }) {
  // 작성 폼은 이미 전폭 입력이라 모바일에서도 그대로 쓴다(AM5 목업이 '상단 폼'도 허용).
  // 목록만 테이블 → 카드로 바꾼다.
  const isMobile = useIsMobile()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user || user.role !== 'ADMIN') return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet('/posts?category=NOTICE&page=0&size=100')
      setNotices(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const handleFileChange = (e) => setFiles(prev => [...prev, ...Array.from(e.target.files)])
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false)
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
  }

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      if (files.length > 0) {
        // 첨부파일이 있으면 파일 지원 엔드포인트로 전송(category=NOTICE).
        // 주의: 이 경로는 isNotice=false로 저장되어 상단 고정 공지 배너엔 안 뜨고 일반 피드에 '공지' 뱃지로 노출됨.
        const token = localStorage.getItem('accessToken')
        const formData = new FormData()
        formData.append('title', title.trim())
        formData.append('content', content.trim())
        formData.append('category', 'NOTICE')
        formData.append('userId', user.userId)
        files.forEach(file => formData.append('files', file))
        const res = await fetch('/posts/with-files', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
        const json = await readEnvelope(res)
        if (!json.success) throw new Error(json.message || '공지 등록에 실패했습니다.')
      } else {
        await apiSend('/posts/admin/notices', 'POST', {
          title: title.trim(),
          content: content.trim(),
          adminUserId: user.userId,
        })
      }
      setTitle('')
      setContent('')
      setFiles([])
      await load()
    } catch (e) {
      alert('공지 등록 실패: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = async (n) => {
    setEditing({ postId: n.postId, title: n.title, content: '', _loading: true })
    try {
      const detail = await apiGet(`/posts/${n.postId}`)
      setEditing({ postId: n.postId, title: detail.title, content: detail.content ?? '', _loading: false })
    } catch (e) {
      alert('공지 내용을 불러오지 못했습니다: ' + e.message)
      setEditing(null)
    }
  }

  const handleUpdate = async () => {
    if (!editing) return
    if (!editing.title.trim() || !editing.content.trim()) {
      alert('제목과 내용을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await apiSend(`/posts/${editing.postId}`, 'PUT', {
        title: editing.title.trim(),
        content: editing.content.trim(),
        category: 'NOTICE',
      })
      setEditing(null)
      await load()
    } catch (e) {
      alert('공지 수정 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (n) => {
    if (!window.confirm(`공지 '${n.title}'을(를) 삭제할까요?`)) return
    try {
      await apiSend(`/posts/${n.postId}`, 'DELETE')
      await load()
    } catch (e) {
      alert('삭제 실패: ' + e.message)
    }
  }

  return (
    <AdminShell user={user} onLogout={onLogout} active="notices" title="공지" subtitle="서비스 공지사항을 작성하고 관리합니다">
      {error && <div style={s.errorBox}>데이터를 불러오지 못했습니다: {error}</div>}

      <div style={s.card}>
        <div style={s.cardTitle}><Icon name="megaphone" size={16} color="var(--blue-primary)" /> 공지 작성</div>
        <div style={{ marginBottom: '12px' }}>
          <label style={s.inputLabel}>제목</label>
          <input style={s.input} placeholder="공지 제목" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={s.inputLabel}>내용</label>
          <textarea style={s.textarea} placeholder="공지 내용" value={content} onChange={e => setContent(e.target.value)} />
        </div>

        {/* 첨부파일 */}
        <div style={{ marginBottom: '14px' }}>
          <label style={s.inputLabel}>첨부파일 (선택)</label>
          <div
            onClick={() => fileInputRef.current.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            style={{
              border: `1.5px dashed ${isDragging ? 'var(--blue-primary)' : 'var(--border)'}`, borderRadius: 12, padding: '28px 20px',
              textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: isDragging ? 'var(--blue-tint)' : 'var(--bg)',
            }}
          >
            <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/gif" style={{ display: 'none' }} onChange={handleFileChange} />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--blue-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>파일을 드래그하거나 클릭하여 업로드</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>JPG, PNG, GIF (최대 10MB)</div>
          </div>
          {files.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map((file, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 13px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}><Icon name="paperclip" size={14} /> {file.name}</span>
                  <button onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', display: 'flex', padding: 0 }}><Icon name="x" size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button style={s.btnMint} onClick={handleCreate} disabled={submitting}>
          {submitting ? '등록 중…' : '공지 등록'}
        </button>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>발행된 공지 ({notices.length})</div>
          {notices.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? '불러오는 중…' : '등록된 공지가 없습니다.'}
            </div>
          )}
          {notices.map(n => (
            <div key={n.postId} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue-primary)',
              borderRadius: 14, padding: '13px 14px',
            }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, wordBreak: 'break-word' }}>{n.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, fontSize: 11.5, color: 'var(--text-muted)' }}>
                <span style={{ fontFamily: "'Inter',sans-serif" }}>#{n.postId}</span>
                <span>·</span>
                <span>{fmtDate(n.createdAt)}</span>
                <span>·</span>
                <span>조회 {n.viewCount ?? 0}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => openEdit(n)}
                  style={{
                    flex: 1, minHeight: 44, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)',
                    fontSize: 13.5, fontWeight: 700,
                  }}
                >수정</button>
                <button
                  onClick={() => handleDelete(n)}
                  style={{
                    flex: 1, minHeight: 44, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--danger)',
                    fontSize: 13.5, fontWeight: 700,
                  }}
                >삭제</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div style={s.card}>
        <div style={s.cardTitle}>공지 목록 ({notices.length})</div>
        <table style={s.table}>
          <thead>
            <tr>{['ID', '제목', '작성자', '조회', '작성일', '관리'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {notices.length > 0 ? notices.map(n => (
              <tr key={n.postId} style={s.tr}>
                <td style={s.td}>#{n.postId}</td>
                <td style={{ ...s.td, maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</td>
                <td style={s.td}>{n.nickname}</td>
                <td style={s.td}>{n.viewCount ?? 0}</td>
                <td style={s.td}>{fmtDate(n.createdAt)}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={s.btnMint} onClick={() => openEdit(n)}>수정</button>
                    <button style={s.btnRed} onClick={() => handleDelete(n)}>삭제</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} style={s.emptyRow}>{loading ? '불러오는 중…' : '등록된 공지가 없습니다.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {editing && (
        <div style={s.modalOverlay} onClick={() => setEditing(null)}>
          <div style={{ ...s.modal, width: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>공지 수정 · #{editing.postId}</div>
            {editing._loading ? (
              <div style={s.loading}>내용 불러오는 중…</div>
            ) : (
              <>
                <div style={s.modalRow}>
                  <label style={s.inputLabel}>제목</label>
                  <input style={s.input} value={editing.title} onChange={e => setEditing(v => ({ ...v, title: e.target.value }))} />
                </div>
                <div style={s.modalRow}>
                  <label style={s.inputLabel}>내용</label>
                  <textarea style={{ ...s.textarea, minHeight: '160px' }} value={editing.content} onChange={e => setEditing(v => ({ ...v, content: e.target.value }))} />
                </div>
                <div style={s.modalActions}>
                  <button style={s.btnGray} onClick={() => setEditing(null)}>취소</button>
                  <button style={s.btnMint} onClick={handleUpdate} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  )
}
