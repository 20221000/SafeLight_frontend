import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import useIsMobile from '../hooks/useIsMobile'
import useAuthNav from '../hooks/useAuthNav'
import Icon from '../components/Icon'
import { POST_CATEGORY } from '../theme/tokens'
import { readEnvelope } from '../utils/apiResponse'

// 모르는 값이면 배지를 아예 그리지 않는다. 예전엔 INFO 로 떨어뜨렸는데,
// GET /posts/{id}(PostDetailResponse)에 category 필드가 없어서 실제로는 모든 글이 '정보'로 찍혔다
// — 공지·질문·팁·안전신고 글을 열어도 '정보' 였다. 없는 값을 그럴듯하게 메우느니 비워 둔다.
// 2026-08-09 백엔드가 category 를 내려주기 시작해 지금은 정상 표시된다. 폴백은 되살리지 말 것.
function CategoryBadge({ category }) {
  const c = POST_CATEGORY[category]
  if (!c) return null
  return <span style={{ display: 'inline-block', background: c.bg, color: c.color, fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 7, fontFamily: "'Inter',sans-serif", letterSpacing: '.3px' }}>{c.label}</span>
}

function Avatar({ name, size = 34 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--blue-tint)', color: 'var(--blue-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, flexShrink: 0 }}>{(name || '?').charAt(0)}</div>
}

// 첨부파일 종류 — 백엔드가 주는 contentType(MIME)으로 판별한다.
// 파일명 확장자는 사용자가 마음대로 바꿀 수 있어 서버가 기록한 MIME 이 더 믿을 만하다.
// 아이콘 세트에 파일 종류별 그림이 없어 색 있는 짧은 라벨로 구분한다.
const FILE_KINDS = [
  { label: '이미지', color: '#0EA5E9', icon: 'camera', match: t => t.startsWith('image/') },
  { label: '영상',   color: '#8B5CF6', icon: 'play',   match: t => t.startsWith('video/') },
  { label: 'PDF',    color: '#E11D48', icon: 'file',   match: t => t === 'application/pdf' },
  { label: '압축',   color: '#F59E0B', icon: 'file',   match: t => /zip|compressed|x-tar|gzip|x-7z|rar/.test(t) },
  { label: '표',     color: '#10B981', icon: 'file',   match: t => /excel|spreadsheet|csv/.test(t) },
  { label: '문서',   color: '#2563EB', icon: 'file',   match: t => /word|hwp|opendocument|presentation|powerpoint|rtf/.test(t) },
  { label: '텍스트', color: '#64748B', icon: 'file',   match: t => t.startsWith('text/') },
]
const FILE_KIND_DEFAULT = { label: '파일', color: 'var(--text-muted)', icon: 'file' }
const fileKind = (contentType) => {
  const t = String(contentType ?? '').toLowerCase()
  if (!t) return FILE_KIND_DEFAULT
  return FILE_KINDS.find(k => k.match(t)) ?? FILE_KIND_DEFAULT
}
// 1KB 미만 파일이 '0.0KB' 로 보이지 않게 단위를 올린다
const fileSize = (bytes) => {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// minWidth:0 필수 — flex 기본 min-width:auto 면 입력칸이 자기 고유폭 아래로 줄지 못해
// 좁은 화면에서 '등록' 버튼이 화면 밖으로 밀려난다.
const commentInputStyle = { flex: 1, minWidth: 0, height: 42, padding: '0 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 11, fontSize: 13.5, color: 'var(--text-strong)', outline: 'none', fontFamily: 'inherit' }
const submitBtnStyle = { height: 42, padding: '0 18px', border: 'none', borderRadius: 11, background: 'var(--blue-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }

// 입력칸이 자라는 최대 높이. 이 이상은 내부 스크롤.
const COMMENT_MAX_H = 120

// 댓글·답글 공용 입력칸.
// - 한 줄이 차면 옆으로 밀지 않고 줄을 바꾸며 칸이 아래로 자란다.
// - 데스크탑: Enter 등록 / Shift+Enter 줄바꿈.
// - 모바일: 화면 키보드가 textarea 에 줄바꿈 키를 띄워주므로 Enter 를 가로채지 않고 줄바꿈으로 넘긴다.
//   (여기서 Enter 를 등록으로 쓰면 줄을 바꾸려다 글이 올라간다. 모바일 등록은 '등록' 버튼으로만.)
function CommentComposer({ value, onChange, onSubmit, placeholder, isMobile }) {
  const taRef = useRef(null)

  // 내용에 맞춰 높이를 다시 잰다. auto 로 되돌려야 줄어들 때도 따라온다.
  useLayoutEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, COMMENT_MAX_H)}px`
  }, [value])

  const handleKeyDown = (e) => {
    if (isMobile) return
    if (e.key !== 'Enter') return
    // 한글 조합 중 Enter 는 글자 확정이지 등록이 아니다.
    if (e.nativeEvent.isComposing) return
    if (e.shiftKey) return
    e.preventDefault()
    onSubmit()
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      <textarea
        ref={taRef}
        rows={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0,
          padding: '11px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 11,
          fontSize: 13.5, color: 'var(--text-strong)', outline: 'none', fontFamily: 'inherit',
          resize: 'none', lineHeight: 1.5, maxHeight: COMMENT_MAX_H, overflowY: 'auto',
        }}
      />
      <button onClick={onSubmit} style={{ ...submitBtnStyle, padding: isMobile ? '0 13px' : '0 18px' }}>등록</button>
    </div>
  )
}

// 댓글/답글 인라인 수정 편집기 (수정 클릭 시 본문 자리를 대체)
function InlineCommentEditor({ value, onChange, onSave, onCancel }) {
  return (
    <div style={{ marginTop: 4 }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        autoFocus
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
          fontSize: 14, color: 'var(--text-strong)', outline: 'none', fontFamily: 'inherit',
          resize: 'vertical', lineHeight: 1.6,
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={onSave} style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 9, background: 'var(--blue-primary)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
        <button onClick={onCancel} style={{ height: 34, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
      </div>
    </div>
  )
}

const commentActionBtn = (color) => ({ border: 'none', background: 'transparent', color, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' })

export default function PostDetailPage({ user, onLogout }) {
  const isMobile = useIsMobile() // 모바일: 페이지 여백 축소(데스크탑 48/30px는 375px에서 너무 넓다)
  const navigate = useNavigate()
  const { goLogin } = useAuthNav()
  const { postId } = useParams()

  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentInput, setCommentInput] = useState('')
  const [replyInputId, setReplyInputId] = useState(null)
  const [replyInput, setReplyInput] = useState('')
  const [editingId, setEditingId] = useState(null)   // 수정 중인 댓글/답글 id (댓글·답글 공용)
  const [editingContent, setEditingContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('') // 조회 실패 사유 (403·404 등)

  // 선언을 effect보다 앞에 둔다 — effect에서 아직 선언 전인 const 를 참조하면 안 된다.
  const fetchPost = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('accessToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`/posts/${postId}`, { headers })
      const json = await readEnvelope(res)
      if (json.success && json.data) {
        setError('')
        setPost(json.data)
        setComments(json.data.comments ?? [])
        setIsLiked(json.data.isLiked ?? false)
        setLikeCount(json.data.likeCount ?? 0)
      } else {
        setError(json.message || '게시글을 불러오지 못했습니다.')
      }
    } catch (err) {
      console.error('게시글 조회 실패:', err)
      setError('서버에 연결하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => { fetchPost() }, [fetchPost])

  const handleLike = async () => {
    if (!user) { alert('로그인이 필요합니다.'); goLogin(); return }
    const token = localStorage.getItem('accessToken')
    if (isLiked) {
      await fetch(`/posts/${postId}/likes`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setIsLiked(false); setLikeCount(prev => prev - 1)
    } else {
      await fetch(`/posts/${postId}/likes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      setIsLiked(true); setLikeCount(prev => prev + 1)
    }
  }

  const handleCommentSubmit = async () => {
    if (!commentInput.trim()) return
    if (!user) { alert('로그인이 필요합니다.'); goLogin(); return }
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      // 작성자는 백엔드가 JWT에서 읽는다. CommentCreateRequest 는 (content, parentId) 뿐이다.
      body: JSON.stringify({ content: commentInput, parentId: null }),
    })
    const json = await readEnvelope(res)
    if (json.success) { setCommentInput(''); fetchPost() }
    else alert(json.message || '댓글 등록에 실패했습니다.')
  }

  const handleReplySubmit = async (parentId) => {
    if (!replyInput.trim()) return
    if (!user) { alert('로그인이 필요합니다.'); return }
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: replyInput, parentId }),
    })
    const json = await readEnvelope(res)
    if (json.success) { setReplyInput(''); setReplyInputId(null); fetchPost() }
    else alert(json.message || '답글 등록에 실패했습니다.')
  }

  const handleCommentDelete = async (commentId, mine = true) => {
    if (!window.confirm(deleteConfirmText(mine, '댓글'))) return
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    const json = await readEnvelope(res)
    if (json.success) fetchPost()
    else alert(json.message || '댓글 삭제에 실패했습니다.')
  }

  const startEdit = (comment) => { setEditingId(comment.commentId); setEditingContent(comment.content ?? '') }
  const cancelEdit = () => { setEditingId(null); setEditingContent('') }

  // PUT /posts/{postId}/comments/{commentId} — body: { content }
  const handleCommentEdit = async (commentId) => {
    if (!editingContent.trim()) return
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: editingContent }),
    })
    const json = await readEnvelope(res)
    if (json.success) { cancelEdit(); fetchPost() }
    else alert(json.message || '댓글 수정에 실패했습니다.')
  }

  // DELETE /posts/attachments/{attachmentId} — 게시글 작성자만 노출
  const handleAttachmentDelete = async (attachmentId) => {
    if (!window.confirm('첨부파일을 삭제할까요?')) return
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/attachments/${attachmentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    const json = await readEnvelope(res)
    if (json.success) fetchPost()
    else alert(json.message || '첨부파일 삭제에 실패했습니다.')
  }

  const handlePostDelete = async () => {
    if (!window.confirm(deleteConfirmText(isPostOwner, '게시글'))) return
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    const json = await readEnvelope(res)
    if (json.success) navigate('/community')
    else alert(json.message || '게시글 삭제에 실패했습니다.')
  }

  const downloadAttachment = async (e, file) => {
    e.preventDefault()
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/attachments/${file.attachmentId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = file.originalFilename; a.click()
    URL.revokeObjectURL(url)
  }

  const isNotice = post?.category === 'NOTICE'

  // 관리자에게 열린 건 '삭제'뿐이다(백엔드 PostService.isOwnerOrAdmin — deletePost·deleteComment).
  // 수정은 게시글·댓글 모두 작성자 검사를 그대로 둬서 관리자가 눌러도 403 이고,
  // 첨부파일 개별 삭제(PostAttachmentService)도 글 작성자만이라 함께 열지 않는다.
  const isAdmin = user?.role === 'ADMIN'
  const isPostOwner = Boolean(user && post && user.userId === post.userId)
  const canDeletePost = isPostOwner || Boolean(user && post && isAdmin)
  const canDeleteComment = (c) => Boolean(user && (user.userId === c.userId || isAdmin))

  // 남의 글을 지우는 건 내 글을 지우는 것과 무게가 다르다. 관리자 권한으로 지울 때는 그렇다고 말한다.
  const deleteConfirmText = (mine, what) =>
    mine ? `${what}을 삭제할까요?` : `다른 사용자의 ${what}입니다. 관리자 권한으로 삭제할까요?`

  return (
    <UserShell user={user} onLogout={onLogout} active="community">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '16px 16px 24px' : '26px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <button onClick={() => navigate('/community')} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>목록으로
          </button>
          {canDeletePost && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 남의 글에 뜬 삭제 버튼은 근거가 보여야 오작동으로 읽히지 않는다. */}
              {!isPostOwner && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>관리자 권한</span>
              )}
              {isPostOwner && (
                <button onClick={() => navigate(`/community/${postId}/edit`)} style={{ height: 36, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
              )}
              <button onClick={handlePostDelete} style={{ height: 36, padding: '0 14px', border: '1px solid var(--danger)', borderRadius: 10, background: 'var(--surface)', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>불러오는 중...</div>
        ) : !post ? (
          // 실패 사유를 알면 그걸 보여준다 — '못 찾음'과 '권한 없음'은 사용자가 할 일이 다르다.
          <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--text-muted)' }}>
            <Icon name="alert-triangle" size={22} color="var(--warning)" />
            <div style={{ marginTop: 8, fontSize: 13.5 }}>{error || '게시글을 찾을 수 없습니다.'}</div>
            {!user && (
              <button onClick={goLogin} style={{ marginTop: 14, height: 38, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--blue-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                로그인하러 가기
              </button>
            )}
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28,
            borderLeft: isNotice ? '4px solid var(--blue-primary)' : '1px solid var(--border)',
          }}>
            {/* 헤더 */}
            <CategoryBadge category={post.category} />
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '12px 0 14px', lineHeight: 1.4, letterSpacing: '-.3px' }}>{post.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar name={post.nickname} size={30} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{post.nickname}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{post.createdAt?.slice(0, 10)}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}><Icon name="eye" size={14} /> {post.viewCount}</span>
              {!isNotice && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}><Icon name="heart" size={14} /> {likeCount}</span>}
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

            {/* 본문 */}
            <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-strong)' }}>
              {post.content?.split('\n').map((line, idx) => <p key={idx} style={{ marginBottom: 8 }}>{line || ' '}</p>)}
            </div>

            {/* 첨부파일 */}
            {post.attachments && post.attachments.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}><Icon name="paperclip" size={15} color="var(--blue-primary)" /> 첨부파일</div>
                {post.attachments.map(file => {
                  const kind = fileKind(file.contentType)
                  return (
                  <div key={file.attachmentId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {/* 다운로드 링크 — 삭제 버튼은 이 <a> 밖 형제로 둔다(안에 넣으면 삭제 클릭이 다운로드까지 유발). */}
                    <a href={`/posts/attachments/${file.attachmentId}`} download={file.originalFilename} onClick={e => downloadAttachment(e, file)}
                      title={file.contentType || undefined}
                      style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ color: kind.color, display: 'flex', flexShrink: 0 }}><Icon name={kind.icon} size={14} /></span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.originalFilename}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, marginLeft: 8 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6, color: kind.color, background: 'var(--surface)', border: `1px solid ${kind.color}33` }}>{kind.label}</span>
                        <span style={{ fontSize: 11 }}>{fileSize(file.size)}</span>
                      </span>
                    </a>
                    {user && user.userId === post.userId && (
                      <button onClick={() => handleAttachmentDelete(file.attachmentId)} title="첨부파일 삭제" aria-label="첨부파일 삭제"
                        style={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--danger)', cursor: 'pointer' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                      </button>
                    )}
                  </div>
                  )
                })}
              </div>
            )}

            {/* 공지가 아니면 좋아요/공유 + 댓글 */}
            {!isNotice && (
              <>
                <div style={{ display: 'flex', gap: 12, padding: '18px 0', margin: '20px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={handleLike} style={{
                    flex: 1, height: 44, borderRadius: 11, fontSize: 14, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                    border: `1px solid ${isLiked ? 'var(--danger)' : 'var(--border)'}`,
                    background: isLiked ? 'rgba(225,29,72,.08)' : 'var(--surface)',
                    color: isLiked ? 'var(--danger)' : 'var(--text-muted)',
                  }}><Icon name="heart" size={16} /> 좋아요 {likeCount}</button>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('링크가 복사되었습니다.') }} style={{ flex: 1, height: 44, borderRadius: 11, fontSize: 14, cursor: 'pointer', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontFamily: 'inherit' }}><Icon name="link" size={16} /> 공유하기</button>
                </div>

                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}><Icon name="message" size={17} color="var(--blue-primary)" /> 댓글 {comments.length}개</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 20 }}>
                  {/* 모바일에서는 내 아바타를 빼고 그 폭을 입력칸에 준다. 좁은 기기(280px)에서는
                      아바타·줄바꿈·등록이 다 들어가면 입력칸이 30px까지 눌려 쓸 수 없다. */}
                  {!isMobile && <Avatar name={user?.nickname} size={36} />}
                  {user ? (
                    <CommentComposer
                      value={commentInput}
                      onChange={setCommentInput}
                      onSubmit={handleCommentSubmit}
                      placeholder="댓글을 입력해주세요..."
                      isMobile={isMobile}
                    />
                  ) : (
                    <div onClick={() => { alert('로그인이 필요합니다.'); goLogin() }} style={{ ...commentInputStyle, display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>댓글을 작성하려면 로그인이 필요합니다.</div>
                  )}
                </div>

                {comments.length > 0 ? comments.map(comment => (
                  <div key={comment.commentId}>
                    <div style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                      <Avatar name={comment.nickname} size={34} />
                      {/* minWidth:0 — 긴 닉네임이 칸을 넓혀 본문이 화면을 넘지 않게. */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{comment.nickname}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{comment.createdAt?.slice(0, 10)}</span>
                        </div>
                        {/* pre-wrap: 입력한 줄바꿈을 그대로 보여준다. break-word: 긴 단어가 칸을 넘지 않게. */}
                        {editingId === comment.commentId ? (
                          <InlineCommentEditor value={editingContent} onChange={setEditingContent} onSave={() => handleCommentEdit(comment.commentId)} onCancel={cancelEdit} />
                        ) : (
                          <>
                            <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{comment.content}</div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                              {user && <button onClick={() => setReplyInputId(replyInputId === comment.commentId ? null : comment.commentId)} style={commentActionBtn('var(--text-muted)')}>답글</button>}
                              {user && user.userId === comment.userId && <button onClick={() => startEdit(comment)} style={commentActionBtn('var(--text-muted)')}>수정</button>}
                              {canDeleteComment(comment) && <button onClick={() => handleCommentDelete(comment.commentId, user.userId === comment.userId)} style={commentActionBtn('var(--danger)')}>삭제</button>}
                            </div>
                          </>
                        )}
                        {replyInputId === comment.commentId && (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
                            <CommentComposer
                              value={replyInput}
                              onChange={setReplyInput}
                              onSubmit={() => handleReplySubmit(comment.commentId)}
                              placeholder="답글을 입력해주세요..."
                              isMobile={isMobile}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {comment.replies?.map(reply => (
                      <div key={reply.commentId} style={{ display: 'flex', gap: 12, padding: '12px 0 12px 46px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                        <Avatar name={reply.nickname} size={30} />
                        {/* minWidth:0 — 긴 닉네임이 칸을 넓혀 본문이 화면을 넘지 않게. */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{reply.nickname}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{reply.createdAt?.slice(0, 10)}</span>
                          </div>
                          {editingId === reply.commentId ? (
                            <InlineCommentEditor value={editingContent} onChange={setEditingContent} onSave={() => handleCommentEdit(reply.commentId)} onCancel={cancelEdit} />
                          ) : (
                            <>
                              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{reply.content}</div>
                              {canDeleteComment(reply) && (
                                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                  {user.userId === reply.userId && <button onClick={() => startEdit(reply)} style={commentActionBtn('var(--text-muted)')}>수정</button>}
                                  <button onClick={() => handleCommentDelete(reply.commentId, user.userId === reply.userId)} style={commentActionBtn('var(--danger)')}>삭제</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )) : <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>첫 번째 댓글을 작성해보세요!</div>}
              </>
            )}
          </div>
        )}
      </div>
    </UserShell>
  )
}
