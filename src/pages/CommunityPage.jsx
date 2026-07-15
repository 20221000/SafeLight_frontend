import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import { POST_CATEGORY } from '../theme/tokens'

// 탭 라벨 → 백엔드 카테고리. '안전 신고'는 커뮤니티 신고글(REPORT), 원클릭 긴급신고와 무관.
const CATEGORIES = ['전체', '공지', '정보', '질문', '안전 신고', '팁']
const CATEGORY_MAP = {
  '전체': null, '공지': 'NOTICE', '정보': 'INFO', '질문': 'QUESTION', '안전 신고': 'REPORT', '팁': 'TIP',
}

function CategoryBadge({ category }) {
  const c = POST_CATEGORY[category] ?? POST_CATEGORY.INFO
  return (
    <span style={{
      display: 'inline-block', background: c.bg, color: c.color, fontSize: 10.5, fontWeight: 800,
      padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap', fontFamily: "'Inter',sans-serif", letterSpacing: '.3px',
    }}>{c.label}</span>
  )
}

export default function CommunityPage({ user, onLogout }) {
  const navigate = useNavigate()

  const [activeCategory, setActiveCategory] = useState('전체')
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [posts, setPosts] = useState([])
  const [notices, setNotices] = useState([])
  const [pageInfo, setPageInfo] = useState(null)
  const [popularPosts, setPopularPosts] = useState([])
  const [stats] = useState({ todayPosts: null, totalMembers: null })
  const [loading, setLoading] = useState(false)

  const fetchPosts = async () => {
    setLoading(true)
    try {
      let url = ''
      if (searchKeyword) {
        url = `/posts/search?keyword=${encodeURIComponent(searchKeyword)}&page=${currentPage}&size=10&sort=latest`
      } else if (activeCategory === '전체') {
        url = `/posts/community?page=${currentPage}&size=10`
      } else {
        url = `/posts?category=${CATEGORY_MAP[activeCategory]}&page=${currentPage}&size=10&sort=latest`
      }
      const token = localStorage.getItem('accessToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(url, { headers })
      const json = await res.json()
      if (!json.success) return
      if (activeCategory === '전체' && !searchKeyword) {
        setNotices(json.data.notices ?? [])
        setPosts(json.data.items ?? [])
        setPageInfo(json.data.pageInfo ?? null)
      } else {
        setNotices([])
        setPosts(json.data.items ?? [])
        setPageInfo(json.data.pageInfo ?? null)
      }
    } catch (err) {
      console.error('게시글 조회 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPosts() }, [activeCategory, currentPage, searchKeyword])

  const handleSearch = () => { setSearchKeyword(searchInput); setCurrentPage(0) }
  const handleCategoryChange = (cat) => { setActiveCategory(cat); setCurrentPage(0); setSearchKeyword(''); setSearchInput('') }
  const handlePostClick = async (postId) => {
    const token = localStorage.getItem('accessToken')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    await fetch(`/posts/${postId}/view`, { method: 'POST', headers })
    navigate(`/community/${postId}`)
  }

  return (
    <UserShell user={user} onLogout={onLogout} active="community">
      <div style={{ display: 'flex', gap: 20, padding: '26px 48px', maxWidth: 1560, margin: '0 auto', alignItems: 'flex-start' }}>
        {/* 피드 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px' }}>커뮤니티</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>동네 안전 정보를 나누는 공간</div>
            </div>
            <button
              onClick={() => { if (!user) { alert('로그인이 필요합니다.'); navigate('/login'); return } navigate('/community/write') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', border: 'none', borderRadius: 12,
                background: 'var(--blue-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(37,99,235,.28)', fontFamily: 'inherit',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              글쓰기
            </button>
          </div>

          {/* 검색 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 14px', marginBottom: 14,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="게시글 검색..."
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: 'var(--text-strong)', fontFamily: 'inherit' }}
            />
            <button onClick={handleSearch} style={{ border: 'none', background: 'transparent', color: 'var(--blue-primary)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>검색</button>
          </div>

          {/* 탭 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => {
              const on = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  style={{
                    padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                    background: on ? 'var(--blue-primary)' : 'var(--surface)',
                    color: on ? '#fff' : 'var(--text-muted)', fontWeight: on ? 700 : 500,
                  }}
                >{cat}</button>
              )
            })}
          </div>

          {/* 공지 */}
          {notices.length > 0 && (
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notices.map(notice => (
                <div
                  key={notice.postId}
                  onClick={() => handlePostClick(notice.postId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer',
                    background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue-primary)', borderRadius: 12,
                  }}
                >
                  <CategoryBadge category="NOTICE" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notice.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{notice.createdAt?.slice(0, 10)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>👁 {notice.viewCount}</span>
                </div>
              ))}
            </div>
          )}

          {/* 게시글 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>불러오는 중...</div>
            ) : posts.length > 0 ? (
              posts.map(post => (
                <div
                  key={post.postId}
                  onClick={() => handlePostClick(post.postId)}
                  style={{ padding: 16, cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                    <CategoryBadge category={post.category} />
                    <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>{post.nickname}</span>
                    <span>{post.createdAt?.slice(0, 10)}</span>
                    <span>👁 {post.viewCount}</span>
                    <span>❤ {post.likeCount}</span>
                    <span>💬 {post.commentCount}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>게시글이 없습니다.</div>
            )}
          </div>

          {/* 페이지네이션 */}
          {pageInfo && pageInfo.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '24px 0' }}>
              <PageBtn label="‹" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} />
              {Array.from({ length: pageInfo.totalPages }, (_, i) => i).map(n => (
                <PageBtn key={n} label={n + 1} active={currentPage === n} onClick={() => setCurrentPage(n)} />
              ))}
              <PageBtn label="›" onClick={() => setCurrentPage(p => Math.min(pageInfo.totalPages - 1, p + 1))} disabled={currentPage === pageInfo.totalPages - 1} />
            </div>
          )}
        </div>

        {/* 우측 컬럼 */}
        <aside style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🔥 인기 게시글</div>
            {popularPosts.length > 0 ? popularPosts.map((post, idx) => (
              <div key={post.postId} onClick={() => handlePostClick(post.postId)} style={{ display: 'flex', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--blue-tint)', color: 'var(--blue-primary)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'Inter',sans-serif" }}>{idx + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.4 }}>{post.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>❤ {post.likeCount}</div>
                </div>
              </div>
            )) : <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>데이터 준비 중입니다.</div>}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📊 커뮤니티 통계</div>
            {[
              { label: '전체 게시글', value: pageInfo?.totalElements },
              { label: '오늘 게시글', value: stats.todayPosts },
              { label: '전체 회원', value: stats.totalMembers },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.label}</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Inter',sans-serif" }}>{item.value != null ? item.value.toLocaleString() : '-'}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </UserShell>
  )
}

function PageBtn({ label, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32, height: 32, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit',
        border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
        background: active ? 'var(--blue-primary)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500,
        opacity: disabled ? .5 : 1,
      }}
    >{label}</button>
  )
}
