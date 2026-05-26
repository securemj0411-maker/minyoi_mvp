# Wave 757 — 운영자풀 source filter 0 결과 버그 fix

- 시간: 2026-05-26 KST
- 트리거: 사용자 보고 — "운영자풀 당근마켓 source 선택했는데 아무것도 안 나옴. 41개 ready 있는 거 확실".

## 발견

DB 측정:
- `mvp_candidate_pool where status=ready` 합: 689 (bunjang 560 / joongna 89 / daangn 40)
- `mvp_raw_listings where source=daangn` 합: **43,960**

기존 source filter (admin/pool-listings/route.ts:107-118):
```ts
const sourceRes = await restFetch(
  `mvp_raw_listings?select=pid&source=eq.daangn&limit=5000`
);
const sourcePids = ...;  // 5000 daangn pids (43,960 중 임의)
applyPidScope(sourcePids);  // 풀과 intersect → 풀 ready 40개 중 sourcePids 에 없으면 drop
```

**버그**: raw_listings 43,960 중 LIMIT 5000 만 가져옴 (PostgREST default order). 풀 ready 40 daangn pids 가 그 5000 안에 없을 가능성 큼 → intersect 결과 0.

bunjang/joongna 도 raw 늘어나면 같은 버그.

## 변경

`src/app/api/admin/pool-listings/route.ts:107-138`

새 흐름:
1. 풀 ready pids 먼저 fetch (작음, ~700)
2. 500 단위 chunk 로 `mvp_raw_listings?pid=in.(chunk)&source=eq.daangn` 조회
3. 매칭된 pids 만 `applyPidScope`

각 chunk URL 안전 (500 pids ≈ 7KB URL). 풀 700개 = 2 chunk = 2 query.

## 검증
- `npx tsc --noEmit` 0 에러
- DB 측정으로 데이터 존재 확인 (daangn ready 40건)

## 위험
- 0. fix-only. 다른 filter 로직 변경 X.
- 풀 ready 가 5000 초과로 늘면 첫 fetch 도 truncate 가능 — 단 현재 ~700 이라 멀음. 미래 alarm 필요 시 limit 확대 또는 paging.

## 다음
- 운영 후 source 필터 결과 정상 확인.
- 같은 패턴 (pre-fetch + intersect) sku/category filter 들도 raw 크면 같은 버그 가능성 — audit 권장.
