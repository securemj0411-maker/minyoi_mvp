## Wave 726 — 모바일 nav drawer 핫딜 알림 link + admin-pool emerald 일괄 통일

- 시간: 2026-05-23 KST
- 발견: Wave 723 audit 후속.
  - 모바일에서 dashboard sidebar `hidden lg:block` → 핫딜 알림 (텔레그램 연동) 설정 접근 불가. 사용자 선택: 공략집은 불필요하지만 핫딜 알림 link 한 줄만 drawer 에 추가.
  - admin-pool-browser 카드 17곳 emerald 잔재. 운영자(MJ) 전용 화면이라 입문자 영향 없지만 시각 일관성 위해 토스 블루 통일.

### 변경

#### 1. [src/components/app-nav.tsx](../../src/components/app-nav.tsx)
- `mobileNavLinks` (user 로그인 시) 에 신규 entry 추가:
  - `{ href: "/me?view=hotdeal-alerts", label: "핫딜 알림", caption: "텔레그램 알림 설정" }`
- "추천 피드" 다음, "크레딧 충전" 앞에 배치 — 자주 보는 순서.
- `me-dashboard-client.tsx:85` `VALID_VIEWS` 에 `"hotdeal-alerts"` 이미 박혀있어 라우팅 OK.

#### 2. [src/components/admin-pool-browser.tsx](../../src/components/admin-pool-browser.tsx)
- 17곳 `emerald-X` → `blue-X` 일괄 변환 (Tailwind shade 동일).
  - 선택 버튼 (border / bg), pagination, 카드 ring/배지, 가격 강조, 상태 배지, link 등.
- broad 변환이지만 admin 화면만 영향 — 사용자 노출 0. spot check: `grep emerald` 0건 잔재.

### 검증
- `npx tsc --noEmit` — 0 error (두 파일).
- `mobileNavLinks` 항목 추가는 type-safe (기존 entries 와 동일 shape).

### 위험
- 모바일 drawer 항목 1개 추가 → 메뉴 길이 +1. visual impact 최소 (drawer 자체가 스크롤 가능).
- admin-pool blue 통일 후 light/dark 모두 시각 검증 필요 (운영자 본인 spot check).

### 다음 (남은 wave 723 audit follow-up)
- 신발 condition_tier DB 측정 → Wave 727 별도 진행
- 팩 오픈 fake progress → 카드 뽑기 UI 폐기 dead code 정리 (별도)
