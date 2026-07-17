// 유저 내비게이션 정의 — 데스크탑 IconRail과 모바일 MobileTabBar가 공유한다.
// label = 데스크탑(레일), shortLabel = 모바일(하단 탭바)
export const USER_NAV = [
  {
    key: 'map', label: '지도', shortLabel: '지도', to: '/', icon: (
      <><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>
    ),
  },
  {
    key: 'route', label: '경로 안내', shortLabel: '경로', to: '/route', icon: (
      <><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="5" r="2.4" /><path d="M8.2 18.2C13 17 15 13 15.6 7.2" /></>
    ),
  },
  {
    key: 'community', label: '커뮤니티', shortLabel: '커뮤니티', to: '/community', icon: (
      <path d="M21 11.5a8 8 0 0 1-8.5 7.9L4 21l1.6-4.2A8 8 0 1 1 21 11.5z" />
    ),
  },
  {
    key: 'myinfo', label: '내 정보', shortLabel: '내 정보', to: '/myinfo', icon: (
      <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>
    ),
  },
]
