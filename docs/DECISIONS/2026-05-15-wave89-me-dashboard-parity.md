# Wave 89 — /me 페이지 다시 보기 모달 시세 표시 + 팔린 매물 숨김

> Status: **applied (code).** /me 페이지에서 (1) terminal state (sold/disappeared) 매물 기본 숨김, (2) "다시 보기" 모달이 카드팩과 동일하게 시세/velocity/skuListingFlow 표시.

CLAUDE.md 6 필드 포맷.

## 0.1 Terminal listing 기본 숨김

- 시간: 2026-05-15 03:30 KST
- 발견: owner 지적 — /me 페이지에서 이미 팔린 매물도 그대로 노출됨. 사용자 입장 혼란 + 클릭 시 죽은 링크. `listing_state`가 sold/disappeared인데 필터 안 됨.
- 변경: `src/app/api/packs/me/route.ts`
  - `TERMINAL_STATES = Set(["sold", "disappeared"])`
  - items 빌드 후 `filter((item) => includeTerminal || !TERMINAL_STATES.has(item.listingState))`
  - `?includeTerminal=1` query param으로 토글 가능 (감사 / 디버깅 용)
- 검증: typecheck clean, test 139/139 pass.
- 위험: 매우 낮음. 기존 사용자가 "아 내가 팔린 매물도 봤었는데" → "왜 사라졌지?" 혼란 가능 — UX에서 별도 토글로 보완 가능. owner 지시 명확.
- 다음: 클라이언트 측 "팔린 매물 보기" 토글 UI 추가 옵션 (필요 시).

## 0.2 다시 보기 모달 = 카드팩 모달 parity

- 시간: 2026-05-15 03:30 KST
- 발견: owner 지적 — /me 다시 보기 모달에 시세 정보 없음. 카드팩 뽑을 때 모달과 다른 느낌. `user-reveal-dashboard.tsx` 219~232에서 `marketBasis.p25Price/median/p75 = null`, `velocityBasis = null`, `skuListingFlow` 자체 미지원으로 fallback only.
- 원인: `/api/packs/me`가 `mvp_market_price_daily` / `mvp_market_velocity_daily` 미조회. raw_listings + parsed만 가져왔음.
- 변경:
  - `src/lib/pack-open.ts`: `fetchLatestMarketStats`, `fetchLatestMarketVelocity`, `marketBasisForCandidate`, `velocityBasisForCandidate` 4개 함수 `export` (route에서 재사용).
  - `src/app/api/packs/me/route.ts`: comparable_key 기반 market_price + velocity batch fetch + skuListingFlow 7d count 집계. RevealItem 타입에 `marketBasis`/`velocityBasis`/`skuListingFlow` 추가.
  - `src/components/user-reveal-dashboard.tsx`: RevealItem 타입 확장. modalResult에서 selectedItem.marketBasis/velocityBasis/skuListingFlow 사용 (fallback 유지).
- 검증:
  - `npx tsc --noEmit` clean
  - `npm run test:core` 139/139 pass
- 위험: 낮음.
  - DB 쿼리 증가: market_price + velocity + 7d raw_listings flow batch — pid 20개 기준 3~5개 추가 쿼리. 응답 latency 200~500ms 증가 예상.
  - 기존 pack-open과 동일한 batch 패턴 (재사용) → 부하 검증됨.
- 다음:
  - 1주 사용자 사용 후 latency 모니터링.
  - 캐시 추가 가능 (comparable_key 시세는 일 단위 갱신이라 5분 캐시 안전).

## 1. 영향 범위

| 컴포넌트 | 변경 |
|---|---|
| `/api/packs/me` GET | 응답에 `marketBasis`/`velocityBasis`/`skuListingFlow` 추가. terminal state 기본 필터. `?includeTerminal=1` 토글. |
| `user-reveal-dashboard.tsx` | RevealItem 타입 확장. 모달이 실제 시세 표시. |
| `pack-open.ts` | 4 helper 함수 export (코드 변경 0, 시그니처 동일). |

## 2. 거론 금지

- Wave 87 카메라 자연 대기, Wave 88 category sweep — 별개 컨텍스트.
- 닌텐도 Switch OLED — 보류 유지.
