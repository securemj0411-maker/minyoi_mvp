# 2026-05-22 — launch-40: source filter URL too long → "매물을 잠시 못 가져왔어요" 버그 fix

## 사용자 짚음
> "?? 중고나라에 예산 전체가 없을수가 없는데 왜 안나오는거지 운영자풀에서봐도 중고나라 많은데 상품"

사용자 admin (creditFeed=true), source=joongna + budget=all 시:
- /me 화면: launch-39 의 amber error box 표시 ("매물을 잠시 못 가져왔어요...")
- 운영자풀(admin-pool-browser): 중고나라 매물 많이 보임 → 모순

## 진단 (DB 확인)
- `mvp_raw_listings`: source=joongna **3,621건**, source=bunjang 297,552건
- `mvp_candidate_pool` status=ready: 총 **335건** (joongna 55, bunjang 280)
- → 매물 있다. backend 가 못 가져오는 게 원인.

### 코드 진단
`src/app/api/packs/pool/route.ts` `loadPool` source filter 절차:
1. `mvp_raw_listings?select=pid&source=eq.joongna&limit=2000` → joongna pid 2000개
2. 그 pid 들 `&pid=in.(P1,P2,...,P2000)` 로 candidate_pool 필터

문제: joongna pid = 13자리 (`7_000_000_000_000+`) × 2000 + 구분자 ≈ **28KB URL**. PostgREST/Supabase URL 한계 (≈16KB) 초과 → **414 URI Too Long** → `restFetch` throw → /api/packs/pool **500** → frontend `setError(...)` + launch-39 의 `setFeedExhausted(true)` → amber error box.

bunjang 은 pid 자릿수 다양 (7~10자) 라 평균 URL 22KB. joongna 가 항상 13자라 더 자주 fail.

또한 `mvp_candidate_pool` 에는 source 컬럼 자체가 없다 (`pid, profit_band, ..., comparable_key, status, ...`). 그래서 join 형 쿼리도 불가.

## fix
candidate_pool 풀이 작아서 (총 335) 전체 다 가져와서 application-level 에서 source filter 가 안전:

1. **source clause 제거** — `candidate_pool` 쿼리에서 `pid=in.(2000개)` 절 제거
2. **별도 짧은 source mapping fetch** — candidate_pool fetch 후 allCandidatePids(~500) 의 source 만 fetch:
   ```
   mvp_raw_listings?select=pid,source&pid=in.(P1,...,P335)
   ```
   URL ≈ 335 × 14 = 4.7KB. 안전.
3. **`sourcePass` filter** — budget filter 와 함께 다양화 전에 적용.
4. options.source 가 null 일 땐 source fetch 자체 skip (성능).

## 부수 효과
- source=joongna 정상 응답 → 사용자 화면에 joongna 매물 표시.
- source=bunjang 도 동일 fix 적용 (이전 fail 케이스 모두 해소).
- candidate_pool 쿼리 URL 항상 짧음 (extra source pid in 절 X).

## 영향
- 코드: `src/app/api/packs/pool/route.ts` `loadPool` 1 곳
- DB / API 스키마: X
- 사용자: source filter 작동 복원 — joongna/bunjang 한 source 만 보기 가능.

## 별 wave 후보
- `mvp_candidate_pool` 에 `source` 컬럼 추가 migration → application-level join 제거 + 인덱싱 효율 ↑
- 단, 현재 풀 크기 (335) 라 application filter 비용 무시 가능. 풀 10배 커지면 검토.

## 메모리 룰
- 일반인 친화: 운영자 화면에 있는 매물이 사용자 화면에도 보여야 함 (감각 일치).
- decision log: 이 파일.
