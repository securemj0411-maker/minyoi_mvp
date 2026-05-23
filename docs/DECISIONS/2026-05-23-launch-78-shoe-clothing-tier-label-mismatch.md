# launch-78 — 신발/의류 tier vs 옛 conditionClass 라벨/비교군 mismatch fix

## 사용자 보고

> "D급 판정받았는데 왜 상세페이지와 쉬운모드에서 ... A급 ... 이렇게 A급이라고 나오는거임?? 엄청난 버그인데???"

상품: **RRL 필드치노(gas station green)** — 매입 150,000원 / 시세 193,200원 / +27,938원 차익.

사용자가 본 mismatch:
- 카드 헤더: **D급** chip (`ConditionTierChip` — 새 5-tier system)
- 상세 페이지 "시세 비교 매물": **"A급 매물끼리만"**, 비교 매물 3개 모두 **"A급"** chip
- 쉬운모드 trend: **"A급 상품 중에서도 싸게 나왔어요"** / **"이 상품은 A급 상품이에요"**

## 원인 — 두 분류체계 동거

미뇨이엔 두 grading axis 가 동시 존재:

1. **옛 `conditionClass`** (전자기기 위주 — Wave 130 이전): `unopened` / `mint` / `clean` / `normal` / `worn` / `flawed` / `low_batt`
   - `clean` → "A급 상품" 라벨
2. **새 `conditionTier`** (신발/의류 — **Wave 714** sweep + cross-tab 기반): `S` / `A` / `B` / `C` / `D` / `UNKNOWN`
   - raw text (시즌/박스/kream/하자/빈티지/구제) 5-axis 매칭 결과

RRL 필드치노 같은 의류 매물은 두 column 모두 채워져 있다:
- `condition_tier = 'D'` (Wave 714 의류 분류기 결과 — gunje/빈티지/낡음 signal)
- `condition_class = 'clean'` (옛 분류기 — 전자기기용 시스템이라 의류엔 의미 없음)

**프론트엔드 코드는 헤더(`LastVerifiedAtBadge`)에서만 신발/의류 isShoeOrClothing 가드로 옛 chip 숨겼지만, 나머지 라벨/문구는 전부 `marketBasis.conditionClass` 그대로 사용** → "A급 상품" 인쇄.

**백엔드 `market-source` API**도 비교군 필터를 `condition_class` 기준으로만 적용 → D급 본 매물에 conditionClass='clean'(A급 의미) 매물들이 시세 비교군으로 들어옴.

## fix

### Frontend (`src/components/pack-reveal-modal.tsx`)

새 helper 3개 추가 (line ~1390):
- `isShoeOrClothingCard(card)` — `comparableKey.startsWith("shoe|"|"clothing|")` 판정.
- `tierGroupLabel(tier)` — "S급 상품" / "A급 상품" / ... / "D급 상품" / "정보 부족 상품".
- `tierShortLabel(tier)` — "S급" / "A급" / ... / "D급" (chip / inline 텍스트).

다음 함수들이 신발/의류면 tier 우선:
- `marketConditionLabel` (전반 condition 라벨)
- `conditionComparisonGroupLabel` (비교군 group 라벨 — "{X} 중에서도 싸게 나왔어요")
- `conditionProductLabel` (상품 라벨 — "이 상품은 X이에요")
- `ComparableListingsPanel` 의 `ccLabel` (헤더 "{X} 매물끼리만" + 빈 상태 메시지)

비교 매물 row chip — `ComparableListing.conditionTier` 새 type 필드 추가 + chip을 각 매물 자기 tier 로 표시 (이전: 본 매물 ccLabel로 일괄). market-source API가 이미 conditionTier 부여 중이라 별도 backend 변경 X.

### Backend (`src/app/api/listings/[pid]/market-source/route.ts`)

비교군 필터에 tier 분리 추가 (line ~226 옆):
```ts
if (
  isShoeOrClothingTarget
  && conditionTier != null && conditionTier !== "UNKNOWN"
  && p.condition_tier != null && p.condition_tier !== "UNKNOWN"
  && p.condition_tier !== conditionTier
) {
  excludeByPid.set(Number(p.pid), true);
  continue;
}
```

- 본 매물 신발/의류 + tier S/A/B/C/D 면 같은 tier 비교 매물만 keep.
- 본 매물 tier UNKNOWN/null 또는 비교 매물 tier null 은 보수적 통과 (backfill 진행 중 — Wave 714 Stage 4).

## 영향

- **D급 본 매물 (RRL 필드치노) — A급 매물 3개 비교군에서 제외됨**. 진짜 D급 같은 등급 비교 매물만 (수 적을 수 있음).
- 시세 산출은 별도 함수(`band-aware-median`)가 여전히 옛 conditionClass 기반 — Wave 714 Stage 5(`weightedNeighborPrice` + `applyClusterRelativePricing` 통합) 미적용. **시세 자체 정확도는 별개 wave**. 이번 fix는 라벨링/비교군 UI 정합성만.
- 신발/의류 외(전자기기 등) — 변동 없음 (옛 conditionClass 그대로).
- 비교군이 0~극소수로 줄 가능성 → 빈 상태 메시지 ("D급 비교 매물 누적 중") 적절. 사용자에게 잘못된 시세 보이는 것보다 정직.

## 남은 후속 (다른 wave)

- **Wave 714 Stage 5 시세 query 통합**: `band-aware-median` / `displayMarketBasis` 등에서 `applyClusterRelativePricing` 호출 — 시세 자체를 tier-aware 로. **시급도 높음 — 라벨만 D인데 시세는 옛 시스템이라 차익 계산 부정확.**
- conditionTier backfill 진행 (Wave 714 Stage 4) — 현재 신발 20.8% / 의류 15.7% (5/23 기준).
- 사용자가 "최근 로그 보고 우리 의류랑 신발 상품 분류체계 좀 다르게 만든거 참고하셈" — 다른 wave (Wave 715 narrow split 진행 중).

## 검증

1. RRL 필드치노 같은 의류 D급 매물 → 헤더 D급 chip + 비교 패널 "D급 매물끼리만" + 쉬운모드 "D급 상품 중에서도..." ✓
2. 일반 전자기기 (옛 conditionClass clean) → "A급 매물끼리만" 그대로 ✓
3. 비교 매물 chip — 의류면 각자 conditionTier 우선, 없으면 본 매물 ccLabel ✓

Owner: caulee1227@gmail.com / 2026-05-23
