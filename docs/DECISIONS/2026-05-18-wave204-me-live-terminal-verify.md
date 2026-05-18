# Wave 204 — /me 재접속 시 삭제/판매/숨김 매물 live verify 후 숨김

## 배경

- 시간: 2026-05-18 14:54 KST
- 사용자 보고: `/me`에서 "애플워치 se3 40mm 미드나잇 gps 단순개봉"이 판매중으로 보이지만 실제 번개장터 상품은 삭제/숨김 상태.
- 사용자 기대: 최초 reveal뿐 아니라 사용자가 `/me`에 재접속할 때도 삭제/판매/숨김/신고 등으로 사라진 상품은 안 보여야 함.

## 확인

### 코드 확인

- `pack-open.ts`는 팩 오픈 직전 `fetchDetail()` + `detectSoldOut()` live verify를 수행.
- 하지만 `/api/packs/me/route.ts`는 live verify가 없었고, `mvp_raw_listings.listing_state/sale_status` snapshot만 읽어서 내려줬음.
- `/me` API는 Wave 200 이후 주석/로직이 엇갈려 있었음:
  - API: `includeTerminalRaw !== "0"` → 기본 terminal 표시
  - client: `hideTerminal=true` → 이미 terminal로 표기된 row만 숨김
  - 문제: DB가 아직 `active`면 client가 숨길 수 없음.

### 로그/DB 확인

- 최근 lifecycle-worker는 약 7분 주기로 돌고 있음.
  - 예: `2026-05-18T05:49:01Z` succeeded, enriched 544, duration 27.2s
  - 바로 뒤 `05:49:28Z` terminal recheck 성격 run은 enriched 0, duration 226ms
- 문제 PID: `397026714`
  - raw before manual correction: `listing_state=active`, `sale_status=SELLING`, `last_seen_at=2026-05-10T21:37:16Z`
  - lifecycle before manual correction: `status=active`, `priority_tier=pool`, `last_checked_at=2026-05-18T05:28:06Z`, `last_check_result=active`
  - live `fetchDetail(397026714)` at 작업 시점: `detail=null` → `detectSoldOut = fetch_failed`
  - candidate_pool before manual correction: `status=ready`

## 변경

### 1. `/api/packs/me` read-time live verify

`src/app/api/packs/me/route.ts`

- 현재 페이지에 내려줄 후보만 `fetchDetail()`로 live verify.
- 기본 concurrency 4, pageSize + 10개 buffer만 확인해서 사용자 페이지 latency와 Bunjang 호출 수를 제한.
- `detail=null`이면 response에서 즉시 숨김 + `disappeared`로 best-effort patch.
- `detectSoldOut()` signal이면 response에서 즉시 숨김 + `sold_confirmed`로 best-effort patch.
- active detail이면 `listingState="active"`, 최신 `saleStatus`만 response에 반영.

### 2. terminal 기본 숨김을 API로 이동

- 기본 `/api/packs/me`는 terminal row를 내려주지 않음.
- 운영/디버그 확인이 필요할 때만 `?includeTerminal=1`.

### 3. live terminal 발견 시 DB 보정

`patchLiveTerminalState()` best-effort:

- `mvp_raw_listings`
  - `listing_state = sold_confirmed | disappeared`
  - `sold_detected_at` 또는 `disappeared_at/last_missing_at`
- `mvp_lifecycle_checks`
  - `status = sold_confirmed | disappeared`
  - `last_checked_at`, `last_check_result`, `state_reason = packs_me_live_*`
- `mvp_candidate_pool`
  - `status=invalidated`
  - `invalidated_reason = packs_me_live_*`

## 즉시 production 보정

문제 PID `397026714` 수동 보정 완료:

- `mvp_raw_listings.listing_state = disappeared`
- `mvp_lifecycle_checks.status = disappeared`
- `mvp_candidate_pool.status = invalidated`
- reason: `manual_packs_me_live_detail_fetch_missing`

## 검증

- `npm run build`: pass
- `npm run test:core`: 446/447 pass
  - 실패 1건은 기존 `tests/wave159h-condition-fallback.test.ts` (`flawed !== worn`)로 본 변경과 무관.
- `npx tsc --noEmit --pretty false`: 기존 `.next` route type mismatch + 오래된 test fixture 타입 오류로 실패. `next build`의 TypeScript 단계는 통과.

## 위험

- `/me` page load마다 최대 pageSize+10 detail fetch가 추가됨. 기본 pageSize 20이면 최대 30건, concurrency 4.
- Bunjang API가 일시 실패하면 `fetchDetail()`은 null을 반환하므로 현재 구현은 해당 매물을 `disappeared`로 숨김. 사용자 노출 정확성 우선 정책상 허용하되, false-hide가 잦으면 source health와 결합하는 보강 필요.
- API total count는 현재 page buffer에서 숨긴 수만 반영하므로 전체 페이지 수는 근사값일 수 있음. 다음 reload 때 DB 보정으로 수렴.

## 다음

- lifecycle-worker 스케줄은 `vercel.json`에 없고 외부 QStash 추정. 운영자가 실제 schedule을 확인해야 함.
- `/me` live verify hidden count를 응답 meta나 collect log로 기록하면 추후 품질 모니터링이 쉬움.
