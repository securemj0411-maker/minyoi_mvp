# Wave 798 — Pool API random shuffle 제거 (거리 정렬 살리기)

- 시간: 2026-05-27 KST
- 트리거: 사용자 — "당근 가까운 거리 먼저 안 나옴. 10km가 1km보다 먼저 나옴".

## 발견

`src/app/api/packs/pool/route.ts` 두 sort 충돌:

**1. Line 714-732 (Wave 797): diversifyByCategory 내부 — daangn 매물 거리 ASC 정렬 ✓**
```ts
const candidateRows = (src === 'daangn' && options.userHomeDaangnFullPath)
  ? [...rows].sort((a, b) => {
      const aDist = daangnDistanceKmByPid.get(a.pid) ?? Number.POSITIVE_INFINITY;
      const bDist = daangnDistanceKmByPid.get(b.pid) ?? Number.POSITIVE_INFINITY;
      if (aDist !== bDist) return aDist - bDist;
      return (b.expected_profit_max ?? 0) - (a.expected_profit_max ?? 0);
    })
  : rows;
```

**2. Line 757-759: 결과 random shuffle ❌**
```ts
const pool = options.sort === "latest"
  ? [...readyRows, ...soldOutRows]
  : [...readyRows, ...soldOutRows].sort(() => Math.random() - 0.5);
```

→ diversifyByCategory 내부 거리 정렬 결과가 **random shuffle 로 뒤섞임**.

**3. Line 1059 sortDaangnItemsByDistance: 마지막 sort 시도 but daangn × daangn 만 적용**
- 다른 source (bunjang/joongna) 끼어있으면 daangn 사이 거리 보장 X
- 게다가 cascade region_id 의 REGION_GEO 매핑 부족 시 `distanceKm=null` → 모두 Infinity 동률 → 순서 유지 (shuffle 그대로)

## 변경

### `src/app/api/packs/pool/route.ts`
```ts
- const pool = options.sort === "latest"
-   ? [...readyRows, ...soldOutRows]
-   : [...readyRows, ...soldOutRows].sort(() => Math.random() - 0.5);
+ const pool = [...readyRows, ...soldOutRows];
```

`diversifyByCategory` 가 이미 처리하는 것:
- 카테고리 quota (`MAX_PER_CATEGORY=5`)
- source quota (`daangn:12, joongna:3`)
- daangn 거리 ASC 정렬 (Wave 797)

→ random shuffle 은 **이 모든 정렬을 망치는 잘못된 step**. 제거.

## 검증

- `npx tsc --noEmit` 0 에러
- diversifyByCategory 내부 정렬 우선순위 보존:
  - Phase 1: source quota (daangn 12, joongna 3) + daangn 거리 ASC 정렬
  - Phase 2: 나머지 차익순
  - Phase 3: category cap 무시 fallback

## 위험

- 0. 단순 sort step 제거.
- shuffle 의 의도 (사용자에게 다양한 매물 노출) 는 diversifyByCategory 의 카테고리/source quota 가 이미 처리. 중복.

## 다음

- Production deploy 후 사용자 피드 확인 — 가까운 daangn 매물이 위로 오는지.
- REGION_GEO 매핑 부족 (cascade 동/읍 단위 매물 좌표 없음) 별도 개선 — Wave 799 후보.
