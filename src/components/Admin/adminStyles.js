// 관리자 페이지 공용 스타일 (White & Blue) — 값은 App.css CSS 변수 참조
export const adminStyles = {
  // KPI / 카드
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  kpiCard: { background: 'var(--surface)', borderRadius: 16, padding: 18, border: '1px solid var(--border)' },
  kpiIcon: { width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kpiLabel: { color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600, marginBottom: 4 },
  kpiValue: { fontSize: 26, fontWeight: 800, fontFamily: "'Inter',sans-serif", letterSpacing: '-.5px' },
  card: { background: 'var(--surface)', borderRadius: 16, padding: 20, border: '1px solid var(--border)' },
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'block' },

  // 테이블
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 700, padding: '10px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { color: 'var(--text-strong)', fontSize: 13, padding: '11px 10px' },
  emptyRow: { color: 'var(--text-muted)', textAlign: 'center', padding: 30, fontSize: 13 },

  // 배지 / 버튼
  badge: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap', fontFamily: "'Inter',sans-serif", letterSpacing: '.3px' },
  btnMint: { background: 'var(--blue-primary)', border: 'none', borderRadius: 9, padding: '7px 13px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  btnGray: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 13px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  btnRed: { background: 'var(--surface)', border: '1px solid var(--danger)', borderRadius: 9, padding: '7px 13px', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  btnOrange: { background: 'var(--warning)', border: 'none', borderRadius: 9, padding: '7px 13px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },

  // 입력
  inputLabel: { display: 'block', color: 'var(--text-muted)', fontSize: 12.5, marginBottom: 7, fontWeight: 600 },
  input: { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 14px', color: 'var(--text-strong)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', minHeight: 120, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px', color: 'var(--text-strong)', fontSize: 13.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 },
  searchInput: { width: '100%', maxWidth: 340, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 14px', color: 'var(--text-strong)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },

  // 상태 메시지
  loading: { color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '40px 0' },
  errorBox: { background: 'rgba(225,29,72,.08)', border: '1px solid var(--danger)', borderRadius: 12, padding: '12px 16px', color: 'var(--danger)', fontSize: 13 },

  // 모달
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modal: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 26, width: 420, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(15,23,42,.2)' },
  modalTitle: { fontSize: 16.5, fontWeight: 800, marginBottom: 16 },
  modalRow: { marginBottom: 14 },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 },
}

// 위험도 배지 — 소프트 배경 + 컬러 텍스트
export const LEVEL_STYLE = {
  HIGH:   { label: 'HIGH',   bg: 'rgba(225,29,72,.10)',  color: 'var(--danger)' },
  MEDIUM: { label: 'MEDIUM', bg: 'rgba(245,158,11,.13)', color: 'var(--warning)' },
  LOW:    { label: 'LOW',    bg: 'rgba(16,185,129,.13)', color: 'var(--safe)' },
}

// 긴급신고 처리 상태 배지
export const STATUS_STYLE = {
  RECEIVED:   { label: '접수',   bg: 'var(--blue-tint)',      color: 'var(--blue-primary)' },
  PROCESSING: { label: '처리중', bg: 'rgba(245,158,11,.13)',  color: 'var(--warning)' },
  RESOLVED:   { label: '해결',   bg: 'rgba(16,185,129,.13)',  color: 'var(--safe)' },
  FALSE:      { label: '오탐',   bg: 'rgba(100,116,139,.12)', color: 'var(--text-muted)' },
}
