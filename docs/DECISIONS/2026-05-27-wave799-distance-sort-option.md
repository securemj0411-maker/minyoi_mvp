# Wave 799 — "가까운 순" 정렬 옵션 추가 (당근 거리 우선)

- 시간: 2026-05-27 KST
- 트리거: 사용자 — "당근 거리 정렬 안 됨. 매입단가순 때문에 10km > 1km 보임. 거리순 필터/정렬 옵션 만들어".

## 발견 (Wave 798 fix 의 한계)

Wave 798 (shuffle 제거) 후에도 거리 정렬 효과 약함:
- default = "매입단가순" → `sortDaangnItemsByDistance` (line 1059) 가 daangn × daangn 만 정렬
- non-daangn (bunjang/joongna) 끼어있으면 daangn 사이 거리 보장 X
- 사용자가 explicit "거리 우선" 옵션 원함

## 변경

### `src/components/explore-client.tsx`
- `SortOption` 타입에 `"distance"` 추가.
- Sort dropdown 에 `<option value="distance">가까운 순 (당근)</option>` 추가.

### `src/app/api/packs/pool/route.ts`
- `loadPool` options `sort?` 타입에 `"distance"` 추가.
- GET handler `sort` 변수 union 에 `"distance"` 추가.
- **신규: `sort === "distance"` 시 강한 정렬 박음 (line 1178 직전)**:
  ```ts
  if (sort === "distance") {
    items = [...items].sort((a, b) => {
      const aDaangn = a.marketplaceSource === "daangn";
      const bDaangn = b.marketplaceSource === "daangn";
      if (aDaangn !== bDaangn) return aDaangn ? -1 : 1;  // daangn 우선
      if (aDaangn && bDaangn) {
        const aDist = a.daangnDistanceKm ?? Infinity;
        const bDist = b.daangnDistanceKm ?? Infinity;
        if (aDist !== bDist) return aDist - bDist;
      }
      return (b.expectedProfitMax ?? 0) - (a.expectedProfitMax ?? 0);
    });
  }
  ```

## 작동 방식

`sort=distance` 선택 시:
1. **Daangn 매물 모두 상위로 모음** (non-daangn 매물 아래로)
2. **Daangn 매물 끼리 거리 ASC 정렬** (가까운 순)
3. Tie-break: 차익 DESC
4. Non-daangn 매물끼리: 차익 DESC

## 검증

- `npx tsc --noEmit` 0 에러
- UI dropdown 에 옵션 추가됨
- `sortDaangnItemsByDistance` (line 1059) 가 추가 정렬도 안전 (이미 sorted 결과 유지)

## 위험

- 0. 단순 sort 옵션 추가.
- 기본 default = `profit_desc` 유지. 사용자 explicit 선택 시만 거리 우선.

## 다음

- 사용자 home_region 없으면 "가까운 순" 옵션 숨김 (별도 wave) — 효과 없는 옵션 노출 방지.
- 좌표 매핑 부족 (cascade region_id) Wave 후 보강.
