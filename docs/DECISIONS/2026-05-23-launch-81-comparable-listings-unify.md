# launch-81 — 비교 매물 UI 3 화면 통일 (운영자풀 패턴 적용)

## 사용자 지시

> "/me피드에 상세보기 눌렀을 때 비교 랑 쉬운모드에 비교랑 좀 다른데?? 상세페이지는 동일 기준/상태유사 이런식으로 다 되어있고 me페이지 운영자풀에는 같은 등급 (B급) / 인접 등급 (±1) 이렇게 되어있는데 좀 다 다름 어떻게 통일 할지?? 일단 지금 쉬운모드 상태비교가 제일 대충 나오는건 확실함"

## Before

| 화면 | 헤더 | 매물 row chip | grouping |
|---|---|---|---|
| 운영자풀 (`market-source-debug.tsx`) | "비교 매물 X개" | 매물 각자 tier (S/A/B/C/D) | **같은 등급(X급) > 인접 등급(±1) > 그 외 > 등급 정보 없음** ✓ |
| 상세페이지 (`ComparableListingsPanel`) | "{ccLabel} 매물끼리만" | 매물 각자 tier (launch-78에서 박음) | "동일 기준/상태 유사/참고 매물" relationLabel (의미 추상적) |
| 쉬운모드 (`BeginnerGuideComparablePreview`) | "{ccLabel}끼리" | **없음** (가장 대충) | 없음 (flat list) |

## 통일 방향 — 운영자풀이 gold standard

- 같은 등급(X급) → 인접 등급(±1) → 그 외 등급 → 등급 정보 없음 grouping
- 매물 row 마다 자기 tier chip
- 출처(번개장터/중고나라) + 시간 라벨

## 적용한 fix

### 1. 공용 helper (pack-reveal-modal.tsx ~line 1420)

```ts
const TIER_ORDER_FOR_DISTANCE = ["S", "A", "B", "C", "D"] as const;
function computeTierDistance(ourTier, sampleTier): number {...}
function tierGroupHeading(ourTier, distance): string {
  if (distance === 0) return `같은 등급 (${ourTier}급)`;
  if (distance === 1) return "인접 등급 (±1)";
  if (distance === 99) return "등급 정보 없음";
  return "그 외 등급";
}
function groupListingsByTierDistance<T>(ourTier, listings): Array<{distance, heading, items}> {...}
```

운영자풀(`market-source-debug.tsx` line 287~315)의 로직과 동일. 신발/의류만 grouping (ourTier 있을 때), 전자기기 같은 옛 conditionClass 매물은 flat.

### 2. 쉬운모드 `BeginnerGuideComparablePreview` 보강

추가된 정보:
- **각 매물 tier chip** (S급/A급/B급/C급/D급) — launch-78 패턴 적용
- **출처 라벨** ("중고나라" / "번개장터")
- **시간 라벨** ("3시간 전")
- **group section 헤더** ("같은 등급 (D급) · 5개")

`ccLabel` 함수도 신발/의류 시 tier 우선 (launch-78 후속). 옛 conditionClass "clean" → "A급" 잘못 표시 차단.

### 3. 상세페이지 `ComparableListingsPanel` 통일

- `relationLabel` ("동일 기준 / 상태 유사 / 참고 매물") **제거** — grouping 헤더가 같은 의미 더 명확히 전달.
- group section 헤더 row (운영자풀과 동일 형식).
- 각 매물 chip 은 자기 tier (launch-78 그대로 유지).
- React import 에 `Fragment` 추가 (group section 묶기).

## 영향

- 신발/의류 매물 — 상세/쉬운모드 둘 다 운영자풀과 같은 grouping 표시.
- 전자기기 매물 — flat list 유지 (옛 conditionClass — tier null).
- 사용자 인지 부담 ↓ — "동일 기준"이 뭔지 추상적이던 게 "같은 등급(D급)"으로 명시.

## 검증

- [x] TS 컴파일 통과 (`pack-reveal-modal.tsx` 에러 0)
- [x] React Fragment import 추가 ("react"에서 Fragment named import — `React.Fragment` 직접 안 됨)
- [ ] 실제 D급 매물 (RRL 필드치노) — 같은 등급(D급) section 만 표시 (다른 등급은 별도). production deploy 후 확인.

## 관련 파일

- [src/components/pack-reveal-modal.tsx](../../src/components/pack-reveal-modal.tsx) — helper + 두 컴포넌트 적용
- [src/components/market-source-debug.tsx](../../src/components/market-source-debug.tsx) — gold standard (참조)
- launch-78 — 신발/의류 tier 라벨 mismatch fix (이 wave 의 직접 trigger)

Owner: caulee1227@gmail.com / 2026-05-23
