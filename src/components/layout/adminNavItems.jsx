// 관리자 내비게이션 정의 — 데스크탑 AdminShell 사이드바와 모바일 MobileAdminTabBar가 공유한다.
// label = 사이드바(섹션 구분 있음), shortLabel = 모바일 하단 탭바(5개, 짧게)
export const ADMIN_ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  reports: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h4" /></>,
  dangerzones: <><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 11a3 3 0 0 0 0-6" /><path d="M18.5 20a5.5 5.5 0 0 0-3-4.9" /></>,
  notices: <><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8A3 3 0 0 1 6 15.5" /></>,
}

// 데스크탑 사이드바: 섹션으로 묶어서 표시
export const ADMIN_SECTIONS = [
  {
    title: '모니터링',
    items: [
      { key: 'dashboard', label: '대시보드', path: '/admin' },
      { key: 'reports', label: '신고 관리', path: '/admin/reports' },
      { key: 'dangerzones', label: '위험 구역', path: '/admin/dangerzones' },
    ],
  },
  {
    title: '관리',
    items: [
      { key: 'users', label: '사용자 관리', path: '/admin/users' },
      { key: 'notices', label: '공지', path: '/admin/notices' },
    ],
  },
]

// 모바일 탭바: 섹션 없이 5개 평면 배열 (대시보드 · 신고 · 사용자 · 위험구역 · 공지)
export const ADMIN_TABS = [
  { key: 'dashboard', shortLabel: '대시보드', path: '/admin' },
  { key: 'reports', shortLabel: '신고', path: '/admin/reports' },
  { key: 'users', shortLabel: '사용자', path: '/admin/users' },
  { key: 'dangerzones', shortLabel: '위험구역', path: '/admin/dangerzones' },
  { key: 'notices', shortLabel: '공지', path: '/admin/notices' },
]
