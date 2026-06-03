import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar'
import SidebarToggleBtn from '../components/Sidebar/SidebarToggleBtn'
import { useNavigation } from '../hooks/useNavigation'
import { useSidebar } from '../hooks/useSidebar'

const CATEGORY_STYLE = {
  'NOTICE':   { bg: '#4A5568', color: '#fff' },
  'INFO':     { bg: '#3182CE', color: '#fff' },
  'QUESTION': { bg: '#00E676', color: '#000' },
  'REPORT':   { bg: '#E53E3E', color: '#fff' },
  'TIP':      { bg: '#D69E2E', color: '#fff' },
}

export default function PostDetailPage({ user, onLogout }) {
  const navigate = useNavigate()
  const handleNavigate = useNavigation()
  const { sidebarOpen, setSidebarOpen } = useSidebar()
  const { postId } = useParams()

  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentInput, setCommentInput] = useState('')
  const [replyInputId, setReplyInputId] = useState(null)
  const [replyInput, setReplyInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPost()
  }, [postId])

  const fetchPost = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('accessToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const res = await fetch(`/posts/${postId}`, { headers })
      const json = await res.json()
      if (json.success) {
        setPost(json.data)
        setComments(json.data.comments ?? [])
        setIsLiked(json.data.isLiked ?? false)
        setLikeCount(json.data.likeCount ?? 0)
      }
    } catch (err) {
      console.error('게시글 조회 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async () => {
    if (!user) { alert('로그인이 필요합니다.'); navigate('/login'); return }
    const token = localStorage.getItem('accessToken')

    if (isLiked) {
      await fetch(`/posts/${postId}/likes`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setIsLiked(false)
      setLikeCount(prev => prev - 1)
    } else {
      await fetch(`/posts/${postId}/likes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setIsLiked(true)
      setLikeCount(prev => prev + 1)
    }
  }

  const handleCommentSubmit = async () => {
    if (!commentInput.trim()) return
    if (!user) { alert('로그인이 필요합니다.'); navigate('/login'); return }

    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: commentInput,
        parentId: null,
        userId: user.userId,
      }),
    })
    const json = await res.json()
    if (json.success) {
      setCommentInput('')
      fetchPost() // 댓글 목록 갱신
    }
  }

  const handleReplySubmit = async (parentId) => {
    if (!replyInput.trim()) return
    if (!user) { alert('로그인이 필요합니다.'); return }

    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: replyInput,
        parentId,
        userId: user.userId,
      }),
    })
    const json = await res.json()
    if (json.success) {
      setReplyInput('')
      setReplyInputId(null)
      fetchPost()
    }
  }

  const handleCommentDelete = async (commentId) => {
    if (!window.confirm('댓글을 삭제할까요?')) return
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (json.success) fetchPost()
  }

  const handlePostDelete = async () => {
    if (!window.confirm('게시글을 삭제할까요?')) return
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (json.success) navigate('/community')
  }

  const s = styles

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      overflow: 'hidden', backgroundColor: '#0D1117', position: 'relative',
    }}>
      <Sidebar
        filters={{ cctv: true, streetLamp: true, safeZone: true }}
        onFilterChange={() => {}}
        user={user}
        onLogout={onLogout}
        onGoLogin={() => navigate('/login')}
        onNavigate={handleNavigate}
        activePage="community"
        isOpen={sidebarOpen}
      />
      <SidebarToggleBtn isOpen={sidebarOpen} onClick={() => setSidebarOpen(prev => !prev)} />

      <main style={s.main}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => navigate('/community')}>← 목록으로</button>
          {user && post && user.userId === post.userId && (
            <button style={s.deleteBtn} onClick={handlePostDelete}>삭제</button>
          )}
        </div>

        <div style={s.scrollArea}>
          {loading ? (
            <div style={s.emptyState}>불러오는 중...</div>
          ) : !post ? (
            <div style={s.emptyState}>게시글을 찾을 수 없습니다.</div>
          ) : (
            <>
              <div style={s.postHeader}>
                <span style={categoryBadgeStyle(post.category)}>{post.category}</span>
                <h1 style={s.postTitle}>{post.title}</h1>
                <div style={s.postMeta}>
                  <div style={s.authorRow}>
                    <div style={s.authorAvatar}>{post.nickname?.charAt(0)}</div>
                    <span style={s.authorName}>{post.nickname}</span>
                  </div>
                  <span style={s.metaText}>{post.createdAt?.slice(0, 10)}</span>
                  <span style={s.metaText}>👁 {post.viewCount}</span>
                  <span style={s.metaText}>❤ {likeCount}</span>
                </div>
                <div style={s.divider} />
              </div>

              <div style={s.postContent}>
                {post.content?.split('\n').map((line, idx) => (
                  <p key={idx} style={s.paragraph}>{line}</p>
                ))}
              </div>
              
              {/* 첨부파일 */}
              {post.attachments && post.attachments.length > 0 && (
                <div style={s.attachmentSection}>
                  <div style={s.attachmentTitle}>📎 첨부파일</div>
                  {post.attachments.map(file => (
                    
                      <a key={file.attachmentId}
                      href={`/posts/attachments/${file.attachmentId}`}
                      style={s.attachmentItem}
                      download={file.originalFilename}
                      onClick={async (e) => {
                        e.preventDefault()
                        const token = localStorage.getItem('accessToken')
                        const res = await fetch(`/posts/attachments/${file.attachmentId}`, {
                          headers: token ? { Authorization: `Bearer ${token}` } : {}
                        })
                        const blob = await res.blob()
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = file.originalFilename
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                    >
                      <span>📄 {file.originalFilename}</span>
                      <span style={{ color: '#A0AEC0', fontSize: '11px' }}>
                        {file.size ? `${(file.size / 1024).toFixed(1)}KB` : ''}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              <div style={s.actionRow}>
                <button
                  style={{ ...s.actionBtn, ...(isLiked ? s.actionBtnActive : {}) }}
                  onClick={handleLike}
                >
                  ❤ 좋아요 {likeCount}
                </button>
                <button
                  style={s.actionBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    alert('링크가 복사되었습니다.')
                  }}
                >
                  🔗 공유하기
                </button>
              </div>

              {/* 댓글 */}
              <div style={s.commentSection}>
                <div style={s.commentTitle}>💬 댓글 {comments.length}개</div>

                <div style={s.commentInputRow}>
                  <div style={s.commentAvatar}>{user ? user.nickname?.charAt(0) : '?'}</div>
                  {user ? (
                    <>
                      <input
                        style={s.commentInput}
                        placeholder="댓글을 입력해주세요..."
                        value={commentInput}
                        onChange={e => setCommentInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCommentSubmit()}
                      />
                      <button style={s.submitBtn} onClick={handleCommentSubmit}>등록</button>
                    </>
                  ) : (
                    <div
                      style={{ ...s.commentInput, display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#A0AEC0' }}
                      onClick={() => { alert('로그인이 필요합니다.'); navigate('/login') }}
                    >
                      댓글을 작성하려면 로그인이 필요합니다.
                    </div>
                  )}
                </div>

                {comments.length > 0 ? (
                  comments.map(comment => (
                    <div key={comment.commentId}>
                      <div style={s.commentItem}>
                        <div style={s.commentAvatar}>{comment.nickname?.charAt(0)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={s.commentHeader}>
                            <span style={s.commentNickname}>{comment.nickname}</span>
                            <span style={s.commentDate}>{comment.createdAt?.slice(0, 10)}</span>
                          </div>
                          <div style={s.commentContent}>{comment.content}</div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            {user && (
                              <button
                                style={s.replyBtn}
                                onClick={() => setReplyInputId(replyInputId === comment.commentId ? null : comment.commentId)}
                              >
                                답글
                              </button>
                            )}
                            {user && user.userId === comment.userId && (
                              <button
                                style={{ ...s.replyBtn, color: '#FF3B3B' }}
                                onClick={() => handleCommentDelete(comment.commentId)}
                              >
                                삭제
                              </button>
                            )}
                          </div>
                          {replyInputId === comment.commentId && (
                            <div style={{ ...s.commentInputRow, marginTop: '8px' }}>
                              <input
                                style={s.commentInput}
                                placeholder="답글을 입력해주세요..."
                                value={replyInput}
                                onChange={e => setReplyInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleReplySubmit(comment.commentId)}
                              />
                              <button style={s.submitBtn} onClick={() => handleReplySubmit(comment.commentId)}>등록</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {comment.replies?.map(reply => (
                        <div key={reply.commentId} style={s.replyItem}>
                          <div style={s.replyAvatar}>{reply.nickname?.charAt(0)}</div>
                          <div style={{ flex: 1 }}>
                            <div style={s.commentHeader}>
                              <span style={s.commentNickname}>{reply.nickname}</span>
                              <span style={s.commentDate}>{reply.createdAt?.slice(0, 10)}</span>
                            </div>
                            <div style={s.commentContent}>{reply.content}</div>
                            {user && user.userId === reply.userId && (
                              <button
                                style={{ ...s.replyBtn, color: '#FF3B3B' }}
                                onClick={() => handleCommentDelete(reply.commentId)}
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div style={s.emptyComment}>첫 번째 댓글을 작성해보세요!</div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function categoryBadgeStyle(category) {
  return {
    display: 'inline-block',
    backgroundColor: CATEGORY_STYLE[category]?.bg ?? '#4A5568',
    color: CATEGORY_STYLE[category]?.color ?? '#fff',
    fontSize: '11px', fontWeight: '700',
    padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap',
  }
}

const styles = {
  main: { flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 28px' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
  backBtn: { background: 'none', border: 'none', color: '#A0AEC0', fontSize: '14px', cursor: 'pointer', padding: 0 },
  deleteBtn: { background: 'none', border: '1px solid #FF3B3B', borderRadius: '6px', padding: '6px 14px', color: '#FF3B3B', fontSize: '13px', cursor: 'pointer' },
  scrollArea: { flex: 1, overflowY: 'auto' },
  emptyState: { color: '#A0AEC0', fontSize: '14px', textAlign: 'center', padding: '60px 0' },
  emptyComment: { color: '#A0AEC0', fontSize: '13px', textAlign: 'center', padding: '30px 0' },
  postHeader: { marginBottom: '16px' },
  postTitle: { color: '#fff', fontSize: '24px', fontWeight: '700', margin: '10px 0 12px 0', lineHeight: '1.4' },
  postMeta: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' },
  authorRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  authorAvatar: { width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#00E676', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' },
  authorName: { color: '#fff', fontSize: '14px', fontWeight: '600' },
  metaText: { color: '#A0AEC0', fontSize: '13px' },
  divider: { height: '1px', backgroundColor: '#1E2535' },
  postContent: { padding: '20px 0' },
  paragraph: { color: '#E2E8F0', fontSize: '15px', lineHeight: '1.8', marginBottom: '8px' },
  actionRow: { display: 'flex', gap: '12px', padding: '16px 0', borderTop: '1px solid #1E2535', borderBottom: '1px solid #1E2535', marginBottom: '24px' },
  actionBtn: { flex: 1, padding: '12px', backgroundColor: '#161B27', border: '1px solid #1E2535', borderRadius: '8px', color: '#A0AEC0', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  actionBtnActive: { backgroundColor: 'rgba(0,230,118,0.1)', border: '1px solid #00E676', color: '#00E676' },
  commentSection: { paddingBottom: '40px' },
  commentTitle: { color: '#fff', fontSize: '16px', fontWeight: '700', marginBottom: '16px' },
  commentInputRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  commentAvatar: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1E2535', border: '1px solid #2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A0AEC0', fontSize: '13px', fontWeight: '600', flexShrink: 0 },
  commentInput: { flex: 1, backgroundColor: '#161B27', border: '1px solid #1E2535', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '13px', outline: 'none' },
  submitBtn: { backgroundColor: '#00E676', border: 'none', borderRadius: '8px', padding: '10px 16px', color: '#000', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 },
  commentItem: { display: 'flex', gap: '12px', padding: '14px 0', borderBottom: '1px solid #1E2535' },
  replyItem: { display: 'flex', gap: '12px', padding: '12px 0 12px 48px', borderBottom: '1px solid #1E2535', backgroundColor: 'rgba(13,17,23,0.5)' },
  replyAvatar: { width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#1E2535', border: '1px solid #2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A0AEC0', fontSize: '11px', fontWeight: '600', flexShrink: 0 },
  commentHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  commentNickname: { color: '#fff', fontSize: '13px', fontWeight: '600' },
  commentDate: { color: '#A0AEC0', fontSize: '12px', flex: 1 },
  commentContent: { color: '#E2E8F0', fontSize: '14px', lineHeight: '1.6' },
  replyBtn: { background: 'none', border: 'none', color: '#A0AEC0', fontSize: '12px', cursor: 'pointer', padding: '4px 0' },
  attachmentSection: { 
    padding: '16px 0', 
    borderTop: '1px solid #1E2535', 
    marginBottom: '16px' 
  },
  attachmentTitle: { 
    color: '#fff', fontSize: '14px', fontWeight: '700', marginBottom: '10px' 
  },
  attachmentItem: { 
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#161B27', borderRadius: '8px',
    padding: '10px 14px', marginBottom: '6px',
    border: '1px solid #1E2535', cursor: 'pointer',
    color: '#A0AEC0', fontSize: '13px', textDecoration: 'none',
  },
}