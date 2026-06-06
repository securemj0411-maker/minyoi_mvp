# Wave 1192 — 피드 무한스크롤 (근처 매물 30개 천장 제거)

날짜: 2026-06-06
관련: Wave 1191 (Medium 업글), Wave 1189 (snapshot)

## 발견 — 30개 천장 (owner 짚음)

owner: "피드 limit 있어서 근처 100개인데 30개만 가져오면 큰일 (더보기 버튼 없는 구조)."

코드 추적 결과 **실재**:
- 첫 로드 6개 (`INITIAL_FEED_PAGE_SIZE = 6`)
- 250ms 뒤 remainder continuation 1회 30개 (`DAANGN_BACKGROUND_FEED_PAGE_SIZE = 30`) → `setItems(data.items)` 교체
- `initialRemainderRequestedRef` 가드로 **1회 후 멈춤** → 더 안 가져옴
- 무한스크롤(IntersectionObserver) 제거됨 (3171행 주석만 잔존)

→ **자동 피드 30개 천장.** 사당동 근처 ready 130개(15만↓ 61개)여도 화면 30개만.

## 의도였지만 owner 의도와 충돌

3273행 주석: "Feed browsing is manual now. Auto-infinite loading made the feed feel like a free shopping catalog."
= 일부러 무한스크롤 꺼서 "공짜 카탈로그" 느낌 방지 (유료 가치 보호 목적).

근데 **피드 자체가 유료 전용** (route.ts:1927 `membership_required → /plans?from=feed`). 무료 노출 0 → "공짜 카탈로그" 우려 자체가 무효. owner 결정: 다 보여줌.

## 변경 — client-side 무한스크롤

snapshot 과 충돌 없이 조화:
1. **서버**: 근처 ready 를 150 까지 snapshot 에 담음 (`BACKGROUND_FEED_PAGE_SIZE` / `DAANGN_BACKGROUND_FEED_PAGE_SIZE` 30 → 150). 요청 1번.
2. **client**: `visibleCount` 로 DOM 점진 렌더 (`INFINITE_SCROLL_STEP = 24`). 스크롤하면 sentinel(IntersectionObserver, rootMargin 800px) 이 보이며 24씩 더 그림.
   - 130개를 한 번에 DOM 에 안 박아서 모바일 안 버벅임
   - snapshot 1개로 스크롤 내내 커버 → 디스크 burst 거의 0

구현 (explore-client.tsx):
- 상수: `BACKGROUND_FEED_PAGE_SIZE` 150, `INFINITE_SCROLL_STEP` 24
- `visibleCount` state + `infiniteScrollSentinelRef`
- `visibleItems = displayItems.slice(0, visibleCount)`
- 필터/정렬/출처/예산/스크랩 전환 시 visibleCount 리셋
- IntersectionObserver → visibleCount += STEP
- map: `displayItems.map` → `visibleItems.map`
- grid 안 sentinel div (`visibleCount < displayItems.length` 일 때만)

## 검증

`npx tsc --noEmit` — src/ 0 error.

## 남은 것 (150 초과 대비)

근처 ready 130 < 150 이라 1차로 다 커버. 만약 한 동네 ready 150 초과면 → visibleCount 가 150 도달 시 다음 batch (excludePids 페이지네이션) 추가 필요. 현재는 150 천장 (대부분 동네 충분). 초과 동네 나오면 후속.

## Sign-off

owner 승인 (무한스크롤 + 유료 전용 확인). 배포 후 사당동 스크롤로 근처 매물 다 뜨는지 검증.
