import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import useIsMobile from '../hooks/useIsMobile'
import useAuthNav from '../hooks/useAuthNav'
import Icon from '../components/Icon'
import { readEnvelope } from '../utils/apiResponse'

// NOTICE(공지)는 관리자 전용이라 제외. REPORT는 커뮤니티 '안전 신고' 글(원클릭 긴급신고와 무관).
const CATEGORIES = ['INFO', 'QUESTION', 'REPORT', 'TIP']
const CATEGORY_LABEL = { INFO: '정보', QUESTION: '질문', REPORT: '안전 신고', TIP: '팁' }

export default function PostWritePage({ user, onLogout }) {
  const isMobile = useIsMobile() // 모바일: 페이지 여백 축소(데스크탑 48/30px는 375px에서 너무 넓다)
  const navigate = useNavigate()
  const { goLogin } = useAuthNav()
  const { postId } = useParams()      // 있으면 수정 모드
  const isEdit = !!postId
  const fileInputRef = useRef(null)

  const [category, setCategory] = useState('INFO')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { alert('로그인이 필요합니다.'); goLogin() }
  }, [user])

  // 수정 모드: 기존 글을 불러와 채운다. 본인 글이 아니면 되돌린다(백엔드도 본인만 수정 허용).
  useEffect(() => {
    if (!isEdit || !user) return
    let alive = true
    ;(async () => {
      const token = localStorage.getItem('accessToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`/posts/${postId}`, { headers })
      const json = await readEnvelope(res)
      if (!alive) return
      if (!json.success || !json.data) { alert(json.message || '게시글을 불러오지 못했습니다.'); navigate('/community'); return }
      const p = json.data
      if (p.userId !== user.userId) { alert('본인 게시글만 수정할 수 있습니다.'); navigate(`/community/${postId}`); return }
      setTitle(p.title ?? '')
      setContent(p.content ?? '')
      if (CATEGORIES.includes(p.category)) setCategory(p.category)
    })()
    return () => { alive = false }
  }, [isEdit, postId, user])

  const handleFileChange = (e) => setFiles(prev => [...prev, ...Array.from(e.target.files)])
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false)
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
  }

  const handleSubmit = async () => {
    if (!user) { alert('로그인이 필요합니다.'); goLogin(); return }
    if (!title.trim()) { alert('제목을 입력해주세요.'); return }
    if (!content.trim()) { alert('내용을 입력해주세요.'); return }
    setLoading(true)
    const token = localStorage.getItem('accessToken')
    try {
      // 수정 모드: PUT /posts/{postId} — 제목·내용·카테고리만. 첨부는 상세 화면에서 개별 관리.
      if (isEdit) {
        const res = await fetch(`/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title, content, category }),
        })
        const json = await readEnvelope(res)
        if (!json.success) { alert(json.message || '게시글 수정에 실패했습니다.'); return }
        navigate(`/community/${postId}`)
        return
      }
      if (files.length > 0) {
        const formData = new FormData()
        formData.append('title', title)
        formData.append('content', content)
        formData.append('category', category)
        formData.append('userId', user.userId)
        files.forEach(file => formData.append('files', file))
        const res = await fetch('/posts/with-files', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
        const json = await readEnvelope(res)
        if (!json.success) { alert(json.message || '게시글 등록에 실패했습니다.'); return }
      } else {
        const res = await fetch('/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title, content, category, userId: user.userId }),
        })
        const json = await readEnvelope(res)
        if (!json.success) { alert(json.message || '게시글 등록에 실패했습니다.'); return }
      }
      navigate('/community')
    } catch {
      alert('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <UserShell user={user} onLogout={onLogout} active="community">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 16px 24px' : '26px 48px' }}>
        {/* 뒤로가기를 제목 위에 두는 흔한 형태. 한 줄에 나란히 두면 제목이 버튼에 딸린 것처럼 보인다.
            padding:0 으로 버튼 기본 여백을 없애야 아래 제목과 왼쪽 선이 맞는다. */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => navigate(isEdit ? `/community/${postId}` : '/community')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 0, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>{isEdit ? '게시글로' : '목록으로'}
          </button>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px', marginTop: 8 }}>{isEdit ? '게시글 수정' : '게시글 작성'}</div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 26 }}>
          {/* 카테고리 */}
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>카테고리</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => {
                const on = category === cat
                return (
                  <button key={cat} onClick={() => setCategory(cat)} style={{
                    padding: '9px 20px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, background: on ? 'var(--blue-primary)' : 'var(--bg)',
                    color: on ? '#fff' : 'var(--text-muted)', fontWeight: on ? 700 : 500,
                  }}>{CATEGORY_LABEL[cat]}</button>
                )
              })}
            </div>
          </div>

          {/* 제목 */}
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>제목</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              {/* minWidth:0 필수 — flex 기본 min-width:auto 면 input 이 고유폭 아래로 줄지 못해
                  좁은 화면에서 카드 밖으로 삐져나온다(아래 내용 칸과 좌우 간격이 어긋나는 원인). */}
              <input value={title} maxLength={100} onChange={e => setTitle(e.target.value)} placeholder="제목을 입력해주세요"
                style={{ flex: 1, minWidth: 0, height: 46, padding: '0 92px 0 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 11, fontSize: 14, color: 'var(--text-strong)', outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ position: 'absolute', right: 14, fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>{title.length} / 100</span>
            </div>
          </div>

          {/* 내용 */}
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>내용</label>
            <div style={{ position: 'relative' }}>
              <textarea value={content} maxLength={5000} onChange={e => setContent(e.target.value)} placeholder="내용을 입력해주세요."
                style={{ width: '100%', minHeight: 280, padding: '14px 16px 34px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 11, fontSize: 14, color: 'var(--text-strong)', outline: 'none', resize: 'vertical', lineHeight: 1.7, fontFamily: 'inherit' }} />
              <span style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>{content.length} / 5000</span>
            </div>
          </div>

          {/* 첨부파일 — 수정 모드에서는 숨긴다. PUT /posts/{postId} 는 파일을 다루지 않으며,
              기존 첨부는 게시글 상세 화면에서 개별 삭제로 관리한다. */}
          {isEdit ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
              첨부파일은 게시글 상세 화면에서 개별 삭제로 관리합니다.
            </div>
          ) : (
          <div>
            <label style={labelStyle}>첨부파일</label>
            <div
              onClick={() => fileInputRef.current.click()}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              style={{
                border: `1.5px dashed ${isDragging ? 'var(--blue-primary)' : 'var(--border)'}`, borderRadius: 12, padding: '36px 20px',
                textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: isDragging ? 'var(--blue-tint)' : 'var(--bg)',
              }}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/gif" style={{ display: 'none' }} onChange={handleFileChange} />
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--blue-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
              <div style={{ fontSize: 14, fontWeight: 600 }}>파일을 드래그하거나 클릭하여 업로드</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>JPG, PNG, GIF (최대 10MB)</div>
            </div>
            {files.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map((file, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 13px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}><Icon name="paperclip" size={14} /> {file.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', display: 'flex', padding: 0 }}><Icon name="x" size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={() => navigate(isEdit ? `/community/${postId}` : '/community')} style={{ height: 46, padding: '0 24px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSubmit} disabled={loading} style={{ height: 46, padding: '0 32px', borderRadius: 12, border: 'none', background: 'var(--blue-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, fontFamily: 'inherit' }}>{loading ? (isEdit ? '수정 중...' : '등록 중...') : (isEdit ? '수정하기' : '등록하기')}</button>
        </div>
      </div>
    </UserShell>
  )
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }
