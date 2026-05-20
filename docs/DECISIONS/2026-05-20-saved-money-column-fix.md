# 2026-05-20 — saved-money API: `id` → `pid` 컬럼 수정

## 증상

Dev server log:

```
[saved-money] failed
err: Supabase REST failed 400 GET /rest/v1/mvp_listing_analysis?select=id&...
column mvp_listing_analysis.id does not exist
Perhaps you meant to reference the column "mvp_listing_analysis.pid".
```

`/me` 페이지의 SavedMoneyCounter 컴포넌트가 500 에러를 받아 사용자에게 "안 잃은 돈" 카운트가 표시되지 않음.

## 원인

`mvp_listing_analysis` 테이블의 PK는 `pid` (다른 모든 호출부 일관). 본 endpoint만 `select=id`로 잘못 박혀 있었음. PostgREST가 400을 반환하면서 친절히 "perhaps you meant pid" suggestion을 내줬는데, count 헤더만 쓰는 패턴이라 컬럼 선택 자체는 dummy였지만 `id` 컬럼 존재 검증에서 fail.

## Fix

[mvp/src/app/api/packs/me/saved-money/route.ts:75](../../src/app/api/packs/me/saved-money/route.ts:75)

- `select=id` → `select=pid` (한 줄 변경)
- 다른 로직 변경 없음. `count=exact` 헤더로 count만 사용하는 패턴 그대로 유지.

## 검증

- `npx tsc --noEmit`: 0 error
- 다른 `mvp_listing_analysis` 호출부 (admin/pool-listings, listings/[pid]/market-source, tick-pipeline, pipeline) 모두 `pid` 사용 — 일관성 OK.

## 3화면 일관성

이 endpoint (`/api/packs/me/saved-money`)는 **단일 consumer**:
- [saved-money-counter.tsx](../../src/components/saved-money-counter.tsx) — `/me` 대시보드의 SavedMoneyCounter
- 운영자풀/사용자 reveal에는 사용 안 됨. 3화면 룰 해당 없음.

## 영향

- 사용자: `/me` SavedMoneyCounter 정상 표시 복구 (이전 500 → 200)
- 데이터: count 계산 동일 (`Prefer: count=exact` 헤더로 content-range 사용)
- 다른 endpoint: 영향 없음

## 후속

- 없음 (한 줄 fix). Wave 182 (2026-05-17) 본 endpoint 추가 시 typo로 들어간 잔재.
