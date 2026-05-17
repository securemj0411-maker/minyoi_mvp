# Wave 175 — 신발 conditionScore mapping + market_stat_missing flag 신발 한정 완화

> 2026-05-17. Wave 174 검증 후 두 번째 pool block 발견 → 추가 fix.

---

## 발견 (Wave 174 검증)

Wave 174 적용 후 (commit a2676b9):
- priceGap > 0 신발 매물 **5건 발생** ✅ (batch median 작동)
- max priceGap 28.9%, max score 40.93
- dirty 1,807 → 1,497 (310건 처리)
- **mvp_candidate_pool 신발 = 여전히 0건** ❌

원인 분석 (5건 매물 score_flags 점검):
- 모두 `coarse_market_price` + **`market_stat_missing`** + **`condition_review`** flag 박힘
- pool-policy.mjs POOL_BLOCK_FLAGS:
  ```
  "market_stat_missing", "condition_review", ...
  ```
- 둘 다 pool 진입 차단

### Block 1: condition_score 0.5 hardcode (신발 parser 버그)

- 신발 매물 2,189건 **전부 condition_score = 0.5**
- 다른 카테고리: avg 0.67~0.77 정상
- 원인: `src/lib/parsers/wave92-fashion-mobility.ts:477` `conditionScore: 0.5` hardcode
- 결과: scoreStage line 3954 `conditionScore < 0.65` → `condition_review` flag → pool 차단
- mint/clean condition_class 매물도 동일 차단

### Block 2: market_stat_missing flag (Wave 174 사각지대)

- Wave 174에서 신발 fallback batch median 5→2 완화로 priceGap 계산은 가능
- 그러나 scoreStage line 3991 `market_stat_missing` flag는 그대로 박힘
- pool-policy가 차단

---

## Fix

### Fix A: 신발 parser conditionScore mapping (wave92-fashion-mobility.ts)

```typescript
// Wave 175 (2026-05-17): condition_class → conditionScore 매핑.
// 옛 코드는 0.5 hardcode — 신발 매물 2,189건 전부 conditionScore < 0.65 →
// tick scoreStage 'condition_review' flag → pool 차단. mint/clean도 박힘.
const conditionScoreMap: Record<ConditionClass, number> = {
  unopened: 1.0,
  mint: 0.95,
  clean: 0.85,
  normal: 0.75,
  worn: 0.55,
  flawed: 0.35,
  low_batt: 0.4,
};
const conditionScore = conditionScoreMap[conditionClassResult] ?? 0.5;
```

`return { ..., conditionScore: 0.5 }` → `conditionScore` 변수 참조.

### Fix B: scoreStage market_stat_missing 신발 한정 (tick-pipeline.ts)

```typescript
if (!hasTrustedMarket) {
  scoreFlags.push("coarse_market_price");
  if (!comparableKey || !marketStat) {
    // Wave 175: 신발 한정 — fallbackMedian > 0 (batch median 계산됨)이면
    // market_stat_missing 박지 X. Wave 174 batch threshold 2 완화 효과를
    // pool-policy block flag가 무효화하던 사각지대 차단.
    const hasShoeFallback = parsed?.category === "shoe" && fallbackMedian > 0;
    if (!hasShoeFallback) scoreFlags.push("market_stat_missing");
  } else if (marketStat.confidence === "low") scoreFlags.push("market_confidence_low");
}
```

### SQL UPDATE (옛 매물 즉시 fix)

```sql
UPDATE mvp_listing_parsed
SET condition_score = CASE condition_class
  WHEN 'unopened' THEN 1.0
  WHEN 'mint' THEN 0.95
  WHEN 'clean' THEN 0.85
  WHEN 'normal' THEN 0.75
  WHEN 'worn' THEN 0.55
  WHEN 'flawed' THEN 0.35
  WHEN 'low_batt' THEN 0.4
  ELSE 0.75
END
WHERE category = 'shoe' AND condition_score::numeric = 0.5;
-- ~2,000건 update
```

신발 매물 2,227건 `score_dirty=true` 박음 → 다음 tick 강제 reprocess.

---

## 검증

- `npx tsc --noEmit` → 변경 파일 에러 0건
- `npm run test:core` → **288/288 pass / 0 fail**

---

## Trade-off

| 측면 | 영향 |
|---|---|
| condition_score | 신발 매물 정확한 값 (mint=0.95, clean=0.85 등) — bug fix |
| market_stat_missing | 신발 한정 batch median 사용 시 flag 안 박음 — Wave 174 fallback의 의도된 효과 살림 |
| 다른 카테고리 | 영향 X (조건문 `parsed?.category === "shoe"` 으로 격리) |
| Precision (신발 한정) | Wave 173/174 trade-off 연장선. safety nets 7개 작동 |

---

## Safety nets (작동 중)

| 안전장치 | Wave | 상태 |
|---|---|---|
| 셀러별 1 pool entry | 138 | ✅ |
| 다중 ID 사기 그룹 차단 | 138b | ✅ |
| 가품 floor tier 1-4 | 141/145/152/155 | ✅ |
| 광고 차단 72 patterns | 148-165 | ✅ |
| 시세 광고 매물 제외 | 163 | ✅ |
| 시세 outlier ceiling (msrp×5) | 171 | ✅ |
| 신발 trustedMedian total≥2 | 173 | ✅ |
| marketStatsLimit 3000 + batch threshold 2 | 174 | ✅ |
| **신발 condition_score + market_stat_missing 신발 한정** | **175** | ✅ |

---

## 다음 (검증)

1. 다음 tick (1분 안) 후 mvp_candidate_pool 신발 진입 검증
2. priceGap > 0 매물 score_flags에 market_stat_missing/condition_review 빠졌는지 확인
3. 사용자 카드 3 화면 노출 확인
4. outlier risk 모니터링

---

## 다른 세션 알아볼 핵심 포인트

1. **2026-05-17 Wave 175**: 신발 conditionScore 0.5 hardcode bug fix + scoreStage market_stat_missing 신발 한정 완화.
2. **신발 parser (wave92-fashion-mobility.ts)** condition_class → conditionScore mapping 박혔음. 가방/자전거는 그대로 (해당 fix 안 됨).
3. **Wave 173 → 174 → 175 cascade** — 각 wave가 다음 차단을 만남. 진짜 끝일지 다음 tick 검증 필요.
4. **safety nets 9개** — outlier 차단 + pool gate 강화 균형.

## Git Commits

```
[next] Wave 175: 신발 conditionScore mapping + market_stat_missing 신발 한정 완화
```
