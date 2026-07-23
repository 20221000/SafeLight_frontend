import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import useIsMobile from '../hooks/useIsMobile'
import useAuthNav from '../hooks/useAuthNav'
import Icon from '../components/Icon'
import { POST_CATEGORY } from '../theme/tokens'
import { readEnvelope } from '../utils/apiResponse'

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
  // 모바일(M5): 사이드바를 피드 아래로 내리고, 글쓰기는 목업대로 플로팅 FAB.
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { goLogin } = useAuthNav()

  const [activeCategory, setActiveCategory] = useState('전체')
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [posts, setPosts] = useState([])
  const [notices, setNotices] = useState([])
  const [pageInfo, setPageInfo] = useState(null)
  // GET /posts/summary → 카테고리별 최신글 { notices, questions, info }. (인기순 API는 백엔드에 없음)
  const [summary, setSummary] = useState({ notices: [], questions: [], info: [] })
  const [stats] = useState({ todayPosts: null, totalMembers: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('') // 조회 실패 사유 (403 등) — 빈 목록과 구분해서 보여준다

  // 모바일은 한 페이지 5개 → 5개를 넘으면 페이지 버튼(1,2,3,4)이 생긴다. 데스크탑은 넓으니 10개 유지.
  const pageSize = isMobile ? 5 : 10

  const fetchPosts = async () => {
    setLoading(true)
    try {
      let url = ''
      if (searchKeyword) {
        url = `/posts/search?keyword=${encodeURIComponent(searchKeyword)}&page=${currentPage}&size=${pageSize}&sort=latest`
      } else if (activeCategory === '전체') {
        url = `/posts/community?page=${currentPage}&size=${pageSize}`
      } else {
        url = `/posts?category=${CATEGORY_MAP[activeCategory]}&page=${currentPage}&size=${pageSize}&sort=latest`
      }
      const token = localStorage.getItem('accessToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(url, { headers })
      const json = await readEnvelope(res)
      if (!json.success) { setError(json.message); setPosts([]); setNotices([]); setPageInfo(null); return }
      setError('')
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
      setError('서버에 연결하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPosts() }, [activeCategory, currentPage, searchKeyword, pageSize])

  // 사이드바 카테고리별 최신글 — 목록과 독립적으로 최초 1회만 조회
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch('/posts/summary', { headers })
        const json = await readEnvelope(res)
        if (!alive || !json.success || !json.data) return
        setSummary({
          notices: json.data.notices ?? [],
          questions: json.data.questions ?? [],
          info: json.data.info ?? [],
        })
      } catch { /* 사이드바는 부가 정보 — 실패해도 본문에 영향 없음 */ }
    })()
    return () => { alive = false }
  }, [])

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
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 20,
        padding: isMobile ? '16px 16px 84px' : '26px 48px', maxWidth: 1560, margin: '0 auto', alignItems: 'flex-start',
      }}>
        {/* 피드 */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px' }}>커뮤니티</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>동네 안전 정보를 나누는 공간</div>
            </div>
            <button
              onClick={() => { if (!user) { alert('로그인이 필요합니다.'); goLogin(); return } navigate('/community/write') }}
              title="글쓰기"
              style={isMobile ? {
                position: 'fixed', right: 16, bottom: 'calc(72px + env(safe-area-inset-bottom))', zIndex: 30,
                width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--blue-primary)', color: '#fff', boxShadow: '0 6px 18px rgba(37,99,235,.38)',
              } : {
                display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', border: 'none', borderRadius: 12,
                background: 'var(--blue-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(37,99,235,.28)', fontFamily: 'inherit',
              }}
            >
              <svg width={isMobile ? 24 : 17} height={isMobile ? 24 : 17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              {!isMobile && '글쓰기'}
            </button>
          </div>

          {/* 검색 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 14px', marginBottom: 14,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
            {/* minWidth:0 필수 — 없으면 좁은 화면에서 '검색' 버튼을 밖으로 밀어낸다. */}
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="게시글 검색..."
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: 'var(--text-strong)', fontFamily: 'inherit' }}
            />
            <button onClick={handleSearch} style={{ border: 'none', background: 'transparent', color: 'var(--blue-primary)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>검색</button>
          </div>

          {/* 탭 — 들어가는 폭에서는 한 줄, 안 들어가면 다음 줄로 내린다.
              가로 스크롤은 쓰지 않는다: 스크롤바가 없으면 화면 밖 칩을 발견할 방법이 없다.
              실제 기기(375px~)에서는 칩이 한 줄에 다 들어가므로 wrap 이어도 한 줄로 보인다. */}
          <div
            style={{
              display: 'flex', gap: isMobile ? 6 : 8, marginBottom: 18,
              flexWrap: 'wrap',
              rowGap: isMobile ? 6 : 8,
            }}
          >
            {CATEGORIES.map(cat => {
              const on = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  style={{
                    padding: isMobile ? '7px 11px' : '8px 16px', borderRadius: 20,
                    fontSize: isMobile ? 12.5 : 13, cursor: 'pointer', fontFamily: 'inherit',
                    flexShrink: 0, whiteSpace: 'nowrap',
                    border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                    background: on ? 'var(--blue-primary)' : 'var(--surface)',
                    color: on ? '#fff' : 'var(--text-muted)', fontWeight: on ? 700 : 500,
                  }}
                >{cat}</button>
              )
            })}
          </div>

          {/* 공지 — 최신 3개까지만 노출한다(백엔드 getCommunity 도 findTop3...로 3개만 내려주는 의도된 동작).
              데스크탑·모바일 동일. */}
          {notices.length > 0 && (
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notices.slice(0, 3).map(notice => (
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
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}><Icon name="eye" size={13} /> {notice.viewCount}</span>
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
                    <span><Icon name="eye" size={13} /> {post.viewCount}</span>
                    <span><Icon name="heart" size={13} /> {post.likeCount}</span>
                    <span><Icon name="message" size={13} /> {post.commentCount}</span>
                  </div>
                </div>
              ))
            ) : error ? (
              // 조회 실패는 '글이 없음'과 다르다 — 사유를 보여주고, 로그인 문제면 바로 갈 수 있게 한다.
              <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--text-muted)' }}>
                <Icon name="alert-triangle" size={22} color="var(--warning)" />
                <div style={{ marginTop: 8, fontSize: 13.5 }}>{error}</div>
                {!user && (
                  <button onClick={goLogin} style={{ marginTop: 14, height: 38, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--blue-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    로그인하러 가기
                  </button>
                )}
              </div>
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

        {/* 우측 컬럼 — 모바일에서는 피드 아래로 내려오므로, 얇은 가로선으로 게시글 영역과 구분한다.
            데스크탑은 별도 우측 컬럼이라 구분선이 필요 없다. */}
        <aside style={{
          width: isMobile ? '100%' : 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14,
          ...(isMobile ? { borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 4 } : {}),
        }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}><Icon name="flame" size={15} color="var(--blue-primary)" /> 카테고리별 최신글</div>
            {(summary.notices.length + summary.questions.length + summary.info.length) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { key: 'notices', label: '공지', cat: 'NOTICE', items: summary.notices },
                  { key: 'questions', label: '질문', cat: 'QUESTION', items: summary.questions },
                  { key: 'info', label: '정보', cat: 'INFO', items: summary.info },
                ].filter(g => g.items.length > 0).map(g => (
                  <div key={g.key}>
                    <div style={{ marginBottom: 8 }}><CategoryBadge category={g.cat} /></div>
                    {g.items.slice(0, 4).map(post => (
                      <div key={post.postId} onClick={() => handlePostClick(post.postId)} style={{ display: 'flex', gap: 8, marginBottom: 9, cursor: 'pointer', alignItems: 'baseline' }}>
                        {/* minWidth:0 — 긴 제목이 칸을 넘치지 않게. */}
                        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                        <div style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}><Icon name="eye" size={11} /> {post.viewCount}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>데이터 준비 중입니다.</div>}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}><Icon name="bar-chart" size={15} color="var(--blue-primary)" /> 커뮤니티 통계</div>
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
