import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import UserShell from '../components/layout/UserShell'
import ActionSheet from '../components/layout/ActionSheet'
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

// 백엔드 PostService.buildSearchSort 가 받는 값 5종. 여기 없는 값을 보내면 조용히 latest 로 떨어진다.
// metric = 그 정렬의 근거가 되는 지표. 목록에서 해당 숫자만 강조해 "왜 이 순서인지" 보이게 한다.
const SORT_OPTIONS = [
  { code: 'latest',   label: '최신순',   metric: null },
  { code: 'oldest',   label: '오래된순', metric: null },
  { code: 'views',    label: '조회순',   metric: 'viewCount' },
  { code: 'likes',    label: '좋아요순', metric: 'likeCount' },
  { code: 'comments', label: '댓글순',   metric: 'commentCount' },
]
// 사이드바 '카테고리별 인기글'에 그릴 순서.
// 다섯 카테고리를 전부 GET /posts?category=X 로 받는다. /posts/summary 는 쓰지 않는다 —
// 그쪽은 findTop5ByCategoryOrderByCreatedAtDesc 라 최신순이 이름에 박혀 있어 좋아요순을 못 낸다
// (게다가 NOTICE·QUESTION·INFO 세 개만 준다). getPostsByCategory 는 buildSearchSort 를 태워
// likes 를 받고 다섯 카테고리를 모두 허용하므로, 여기서는 그쪽 하나로 통일하는 편이 맞다.
const POPULAR_CATEGORIES = ['NOTICE', 'INFO', 'QUESTION', 'REPORT', 'TIP']
const POPULAR_SORT = 'likes'  // buildSearchSort: likeCount DESC, 동점이면 createdAt DESC

const sortLabel = (code) => SORT_OPTIONS.find(o => o.code === code)?.label ?? '최신순'
const sortMetric = (code) => SORT_OPTIONS.find(o => o.code === code)?.metric ?? null
const metricStyle = (activeMetric, key) =>
  (activeMetric === key ? { color: 'var(--blue-primary)', fontWeight: 700 } : undefined)

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
  const [sort, setSort] = useState('latest')
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)
  const [posts, setPosts] = useState([])
  const [notices, setNotices] = useState([])
  const [pageInfo, setPageInfo] = useState(null)
  // 카테고리별 인기글 — 카테고리 코드를 그대로 키로 쓴다.
  const [popular, setPopular] = useState({})
  // 조회 실패 사유. 빈 목록과 구분해야 한다 — 이 조회도 로그인이 필요해서 비로그인이면 401 로 비는데,
  // 예전엔 그걸 '데이터 준비 중입니다'로 표시했다(본문은 '로그인이 필요합니다'인데 사이드바만 딴소리였다).
  const [popularError, setPopularError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('') // 조회 실패 사유 (403 등) — 빈 목록과 구분해서 보여준다

  // 모바일은 한 페이지 5개 → 5개를 넘으면 페이지 버튼(1,2,3,4)이 생긴다. 데스크탑은 넓으니 10개 유지.
  const pageSize = isMobile ? 5 : 10

  const fetchPosts = async () => {
    setLoading(true)
    try {
      let url = ''
      if (searchKeyword) {
        url = `/posts/search?keyword=${encodeURIComponent(searchKeyword)}&page=${currentPage}&size=${pageSize}&sort=${sort}`
      } else if (activeCategory === '전체') {
        // getCommunity 도 sort 를 받는다(2026-08-09 백엔드 반영). 상단 공지 3개는
        // findTop3ByIsNoticeTrueOrderByCreatedAtDesc 라 정렬과 무관하게 항상 최신순이고,
        // sort 는 그 아래 일반글 목록에만 걸린다.
        url = `/posts/community?page=${currentPage}&size=${pageSize}&sort=${sort}`
      } else {
        url = `/posts?category=${CATEGORY_MAP[activeCategory]}&page=${currentPage}&size=${pageSize}&sort=${sort}`
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

  useEffect(() => { fetchPosts() }, [activeCategory, currentPage, searchKeyword, pageSize, sort])

  const metricKey = sortMetric(sort)

  // 바깥을 누르면 드롭다운을 닫는다 — 반드시 데스크탑에서만.
  // 모바일 시트는 sortRef 바깥(페이지 최상단)에 그려지므로, 이 핸들러가 켜져 있으면
  // 항목을 누르는 순간 mousedown 단계에서 시트가 언마운트되어 click 이 아예 발생하지 않는다
  // (= 시트는 닫히는데 정렬은 그대로). 모바일은 ActionSheet 의 스크림이 닫기를 담당한다.
  useEffect(() => {
    if (!sortOpen || isMobile) return
    const onDown = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setSortOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [sortOpen, isMobile])

  // 정렬 기준을 바꾸면 페이지를 되돌린다 — 3페이지에서 기준만 바꾸면 엉뚱한 구간이 나온다.
  const changeSort = (code) => { setSort(code); setCurrentPage(0); setSortOpen(false) }

  // 사이드바 카테고리별 인기글 — 목록과 독립적으로 최초 1회만 조회.
  // 카테고리마다 요청이 하나씩 필요하다(한 번에 여러 카테고리를 받는 엔드포인트가 없다).
  // 다섯 개를 한꺼번에 던진다 — 순차로 하면 카드가 다섯 번에 걸쳐 나눠 채워진다.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const token = localStorage.getItem('accessToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const results = await Promise.all(POPULAR_CATEGORIES.map(async cat => {
        try {
          const json = await readEnvelope(await fetch(`/posts?category=${cat}&page=0&size=5&sort=${POPULAR_SORT}`, { headers }))
          return json.success ? { cat, items: json.data?.items ?? [] } : { cat, message: json.message }
        } catch { return { cat, message: '서버에 연결하지 못했습니다.' } }
      }))
      if (!alive) return

      // 전부 실패했을 때만 사유를 띄운다(비로그인이면 다섯 개가 나란히 401 이다).
      // 일부만 실패하면 성공한 카테고리는 그대로 보여주는 게 낫다 — 카드 전체를 지울 이유가 없다.
      const ok = results.filter(r => r.items)
      if (ok.length === 0) { setPopularError(results[0]?.message || '인기글을 불러오지 못했습니다.'); return }
      setPopularError('')
      setPopular(Object.fromEntries(ok.map(r => [r.cat, r.items])))
    })()
    return () => { alive = false }
  }, [])

  // 그릴 그룹만 순서대로 추린다. 빈 카테고리는 배지만 덩그러니 남으므로 뺀다.
  // 데스크탑은 서버가 준 5개를 다 쓴다(우측 컬럼을 채우는 게 목적). 모바일은 이 카드가 피드 아래로
  // 내려오는 자리라 5개씩 5그룹이면 스크롤이 25줄 늘어난다 — 3개씩만 보여준다.
  const popularGroups = POPULAR_CATEGORIES
    .map(cat => ({ cat, items: (popular[cat] ?? []).slice(0, isMobile ? 3 : 5) }))
    .filter(g => g.items.length > 0)

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

          {/* 정렬 바 — 공지 아래·목록 바로 위. 정렬은 목록에만 걸리고 공지 3건에는 안 걸린다. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '0 2px 12px', borderBottom: '1px solid var(--border)', marginBottom: 12,
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {pageInfo
                ? <>전체 <b style={{ color: 'var(--text-strong)', fontWeight: 700, fontFamily: "'Inter',sans-serif" }}>{pageInfo.totalElements?.toLocaleString?.() ?? pageInfo.totalElements}</b>개</>
                : ' '}
            </span>

            <div ref={sortRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setSortOpen(o => !o)}
                title="정렬 기준"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
                  borderRadius: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  border: `1px solid ${sortOpen ? 'var(--blue-primary)' : 'var(--border)'}`,
                  background: 'var(--surface)',
                  color: sortOpen ? 'var(--blue-primary)' : 'var(--text-strong)',
                  cursor: 'pointer',
                }}
              >
                {sortLabel(sort)}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ opacity: 0.7 }}>
                  <path d={sortOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                </svg>
              </button>

              {/* 데스크탑은 팝오버, 모바일은 아래 ActionSheet 로 뜬다. */}
              {sortOpen && !isMobile && (
                <div style={{
                  position: 'absolute', right: 0, top: 40, minWidth: 148, zIndex: 20,
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                  boxShadow: '0 10px 28px rgba(15,23,42,.14)', padding: 6,
                }}>
                  {SORT_OPTIONS.map(o => {
                    const on = o.code === sort
                    return (
                      <button
                        key={o.code}
                        onClick={() => changeSort(o.code)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          width: '100%', height: 38, padding: '0 10px', borderRadius: 9, border: 'none',
                          fontFamily: 'inherit', fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap',
                          background: on ? 'var(--blue-tint)' : 'transparent',
                          color: on ? 'var(--blue-primary)' : 'var(--text-muted)', fontWeight: on ? 700 : 500,
                        }}
                      >
                        {o.label}
                        {on && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

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
                  {/* 정렬 기준이 된 지표만 파랑·굵게로 올린다 — 목록만 보고 왜 이 순서인지 알 수 있게. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>{post.nickname}</span>
                    <span>{post.createdAt?.slice(0, 10)}</span>
                    <span style={metricStyle(metricKey, 'viewCount')}><Icon name="eye" size={13} /> {post.viewCount}</span>
                    <span style={metricStyle(metricKey, 'likeCount')}><Icon name="heart" size={13} /> {post.likeCount}</span>
                    <span style={metricStyle(metricKey, 'commentCount')}><Icon name="message" size={13} /> {post.commentCount}</span>
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
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}><Icon name="flame" size={15} color="var(--blue-primary)" /> 카테고리별 인기글</div>
            {popularGroups.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {popularGroups.map(g => (
                  <div key={g.cat}>
                    <div style={{ marginBottom: 8 }}><CategoryBadge category={g.cat} /></div>
                    {g.items.map(post => (
                      <div key={post.postId} onClick={() => handlePostClick(post.postId)} style={{ display: 'flex', gap: 8, marginBottom: 9, cursor: 'pointer', alignItems: 'baseline' }}>
                        {/* minWidth:0 — 긴 제목이 칸을 넘치지 않게. */}
                        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                        {/* 조회수가 아니라 좋아요를 보여준다 — 이 카드의 순서를 만든 지표가 그것이라
                            숫자가 내림차순으로 읽혀야 "왜 이 순서인지"가 보인다(본문 목록의 metricStyle 과 같은 원칙). */}
                        <div style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}><Icon name="heart" size={11} /> {post.likeCount}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                {popularError || '아직 등록된 글이 없습니다.'}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 모바일 정렬 — 팝오버는 좁은 화면에서 잘리고 터치 타깃도 작다.
          관리자 화면에서 쓰던 ActionSheet 를 그대로 재사용한다(스크림 탭으로 닫힘까지 따라온다). */}
      {sortOpen && isMobile && (
        <ActionSheet
          title="정렬"
          actions={SORT_OPTIONS.map(o => ({
            label: o.label,
            selected: o.code === sort,
            onClick: () => changeSort(o.code),
          }))}
          onClose={() => setSortOpen(false)}
        />
      )}
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
