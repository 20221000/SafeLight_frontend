import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar'
import SidebarToggleBtn from '../components/Sidebar/SidebarToggleBtn'
import { useNavigation } from '../hooks/useNavigation'
import { useSidebar } from '../hooks/useSidebar'

const CATEGORIES = ['INFO', 'QUESTION', 'REPORT', 'TIP']
const CATEGORY_LABEL = {
  'INFO': '정보', 'QUESTION': '질문', 'REPORT': '제보', 'TIP': '팁',
}

export default function PostWritePage({ user, onLogout }) {
  const navigate = useNavigate()
  const handleNavigate = useNavigation()
  const { sidebarOpen, setSidebarOpen } = useSidebar()
  const fileInputRef = useRef(null)

  const [category, setCategory] = useState('INFO')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
    }
  }, [user])

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selected])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...dropped])
  }

  const handleSubmit = async () => {
    if (!user) { alert('로그인이 필요합니다.'); navigate('/login'); return }
    if (!title.trim()) { alert('제목을 입력해주세요.'); return }
    if (!content.trim()) { alert('내용을 입력해주세요.'); return }

    setLoading(true)
    const token = localStorage.getItem('accessToken')

    try {
      if (files.length > 0) {
        // 파일 첨부 있을 때
        const formData = new FormData()
        formData.append('title', title)
        formData.append('content', content)
        formData.append('category', category)
        formData.append('userId', user.userId)
        files.forEach(file => formData.append('files', file))

        const res = await fetch('/posts/with-files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        const json = await res.json()
        if (!json.success) { alert('게시글 등록에 실패했습니다.'); return }
      } else {
        // 파일 없을 때
        const res = await fetch('/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title,
            content,
            category,
            userId: user.userId,
          }),
        })
        const json = await res.json()
        if (!json.success) { alert('게시글 등록에 실패했습니다.'); return }
      }

      navigate('/community')

    } catch (err) {
      alert('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
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
          <h2 style={s.pageTitle}>게시글 작성</h2>
        </div>

        <div style={s.scrollArea}>
          <div style={s.formCard}>

            <div style={s.fieldRow}>
              <label style={s.label}>카테고리</label>
              <div style={s.categoryRow}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    style={{ ...s.categoryBtn, ...(category === cat ? s.categoryBtnActive : {}) }}
                    onClick={() => setCategory(cat)}
                  >
                    {CATEGORY_LABEL[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.fieldRow}>
              <label style={s.label}>제목</label>
              <div style={s.inputWrapper}>
                <input
                  style={s.titleInput}
                  placeholder="제목을 입력해주세요"
                  value={title}
                  maxLength={100}
                  onChange={e => setTitle(e.target.value)}
                />
                <span style={s.charCount}>{title.length} / 100</span>
              </div>
            </div>

            <div style={s.fieldRow}>
              <label style={s.label}>내용</label>
              <div style={{ position: 'relative' }}>
                <textarea
                  style={s.textarea}
                  placeholder="내용을 입력해주세요."
                  value={content}
                  maxLength={5000}
                  onChange={e => setContent(e.target.value)}
                />
                <span style={s.textareaCount}>{content.length} / 5000</span>
              </div>
            </div>

            <div style={s.fieldRow}>
              <label style={s.label}>첨부파일</label>
              <div
                style={{ ...s.dropzone, ...(isDragging ? s.dropzoneActive : {}) }}
                onClick={() => fileInputRef.current.click()}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <span style={{ fontSize: '32px', marginBottom: '8px' }}>☁️</span>
                <span style={s.dropzoneText}>파일을 드래그하거나 클릭하여 업로드</span>
                <span style={s.dropzoneHint}>JPG, PNG, GIF (최대 10MB)</span>
              </div>

              {files.length > 0 && (
                <div style={s.fileList}>
                  {files.map((file, idx) => (
                    <div key={idx} style={s.fileItem}>
                      <span style={s.fileName}>📎 {file.name}</span>
                      <button
                        style={s.fileRemoveBtn}
                        onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={s.bottomRow}>
            <button style={s.cancelBtn} onClick={() => navigate('/community')}>취소</button>
            <button
              style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

const styles = {
  main: { flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px' },
  topBar: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' },
  backBtn: { background: 'none', border: 'none', color: '#A0AEC0', fontSize: '14px', cursor: 'pointer', padding: 0 },
  pageTitle: { color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 },
  scrollArea: { flex: 1, overflowY: 'auto' },
  formCard: { backgroundColor: '#161B27', borderRadius: '12px', padding: '28px', border: '1px solid #1E2535', marginBottom: '16px' },
  fieldRow: { marginBottom: '24px' },
  label: { display: 'block', color: '#A0AEC0', fontSize: '13px', fontWeight: '600', marginBottom: '10px' },
  categoryRow: { display: 'flex', gap: '10px' },
  categoryBtn: { padding: '10px 24px', borderRadius: '8px', border: '1px solid #2D3748', backgroundColor: '#0D1117', color: '#A0AEC0', fontSize: '14px', cursor: 'pointer' },
  categoryBtnActive: { backgroundColor: '#00E676', border: '1px solid #00E676', color: '#000', fontWeight: '700' },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  titleInput: { flex: 1, backgroundColor: '#0D1117', border: '1px solid #2D3748', borderRadius: '8px', padding: '12px 90px 12px 16px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  charCount: { position: 'absolute', right: '16px', color: '#A0AEC0', fontSize: '12px' },
  textarea: { width: '100%', minHeight: '280px', backgroundColor: '#0D1117', border: '1px solid #2D3748', borderRadius: '8px', padding: '14px 16px 32px 16px', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.7', boxSizing: 'border-box', fontFamily: 'inherit' },
  textareaCount: { position: 'absolute', bottom: '12px', right: '16px', color: '#A0AEC0', fontSize: '12px' },
  dropzone: { border: '1.5px dashed #2D3748', borderRadius: '10px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  dropzoneActive: { borderColor: '#00E676', backgroundColor: 'rgba(0,230,118,0.05)' },
  dropzoneText: { color: '#fff', fontSize: '14px', fontWeight: '500', marginBottom: '6px' },
  dropzoneHint: { color: '#A0AEC0', fontSize: '12px' },
  fileList: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  fileItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0D1117', borderRadius: '6px', padding: '8px 12px', border: '1px solid #1E2535' },
  fileName: { color: '#A0AEC0', fontSize: '13px' },
  fileRemoveBtn: { background: 'none', border: 'none', color: '#FF3B3B', fontSize: '14px', cursor: 'pointer' },
  bottomRow: { display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingBottom: '24px' },
  cancelBtn: { padding: '12px 24px', borderRadius: '8px', backgroundColor: 'transparent', border: '1px solid #2D3748', color: '#A0AEC0', fontSize: '14px', cursor: 'pointer' },
  submitBtn: { padding: '12px 32px', borderRadius: '8px', backgroundColor: '#00E676', border: 'none', color: '#000', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
}