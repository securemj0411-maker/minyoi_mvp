# Wave 803g — condition_tier tier-aware 시세 박음 (Wave 722 plan 완료, 1주 박혀있던 fix)

## 사용자 보고

> "폴로 랄프로렌 케이블 니트S 퍼플 — 시세 101,200원
> 비교 매물 12개 (B급 daangn): 110k × 2, 80k × 2, 75k, 57k × 2, 50k × 2, 48k, 47k, 43k (median ~57-75k)
> 이건 도대체 어떻게 시세가 10만원인거야??"

> "condition_class라는거 지금 안쓰는거 아닌가? 옛날 모델 아닌가? 우리 티어로 지금 계산하고있는거 같은데."

→ 사용자 정확. tier 박는 게 정책. 단 production 박혀있지 X.

## 진단

### 매물
- pid 9000981491210
- comparable_key: `clothing|polo_knit_sweater|knit|b_grade`
- condition_class = **mint** (Wave 130 old layer)
- condition_tier = **B** (Wave 715/722 new layer)
- DB sku_median = **101,200**

### per-source 시세 (오늘)

| Source | condition_class | active | blended | sample |
|---|---|---|---|---|
| daangn | mint | 110k | **101,200** ← DB sku_median 박힘 | 3 |
| daangn | clean | 100k | 92k | 24 |
| daangn | normal | 85k | 78k | 18 |
| daangn | worn | 80k | 74k | 5 |

### 비교 매물 박힐 때

```typescript
// market-source/route.ts:228
`...comparable_key=eq.${comparableKey}&needs_review=eq.false&limit=${MAX_COMPARABLES * 6}`
```

→ comparable_key (= condition_tier B 박음) 박은 매물 12개 박힘. condition_class 박지 X.

### 시세 박힐 때

```typescript
// tick-pipeline.ts:4279-4282
const byKey = new Map<string, {
  conditionTier: string;  // Wave 722: shoe/clothing은 S/A/B/C/D/UNKNOWN
  ...
}>();
// line 4331
const conditionTier = ""; // sentinel — tier-bucketing 미적용 (Wave 722 rollback)
```

→ 박은 정책 박혀있지만 code 박은 게 빈 문자열 박음. tier 별 row 박지 X.

## Root cause — Wave 722 hotfix 박힌 후 1주 plan 박혀있지 X

`tick-pipeline.ts:4541-4547`:
```
// Wave 722 hotfix (2026-05-23 13:00 UTC): tier-aware 일시 rollback.
//   파일 13:00 시점에 production cron 3+시간 정체 발견.
//   4-col PK + partial unique index 시도했으나 PostgREST가 partial index의 WHERE 전달 안 함 → 매칭 실패.
//   schema PK 3-col로 rollback + 코드도 3-col on_conflict로 revert.
//   condition_tier 컬럼은 유지 (data 손실 X). 다음 cycle에서 더 안전한 방식으로 재migration.
//   Plan: code deploy 완료 확인 후 schema migration → 시간차 원인 차단.
```

→ 1주일 박혀있는데 박혀있지 X. **PK 3-col 박힌 게 박힌 후 박힌 row 박힐 때 tier 박힌 게 무시 박힘**.

## 검증

| Table | PK | condition_tier 박힌 row |
|---|---|---|
| mvp_market_price_daily | **3-col** (date, comparable_key, condition_class) | 125,884개 다 empty |
| mvp_market_price_daily_per_source | **5-col** (이미 박힘) | 49,630개 다 empty (code 박은 게 "") |

→ **per-source 박힌 PK 박혔지만 code 박지 X**. mvp_market_price_daily 박힌 PK 박지 X.

## Fix

### Step 1 — DB migration (이미 박음)

```sql
ALTER TABLE mvp_market_price_daily DROP CONSTRAINT mvp_market_price_daily_pkey;
ALTER TABLE mvp_market_price_daily ADD CONSTRAINT mvp_market_price_daily_pkey
  PRIMARY KEY (date, comparable_key, condition_class, condition_tier);
```

비파괴 — condition_tier 박힌 게 다 empty 박혀있어서 unique 안 깨짐.

### Step 2 — tick-pipeline.ts:4331

```diff
- const conditionTier = ""; // sentinel — tier-bucketing 미적용 (Wave 722 rollback)
+ const conditionTier = (parsed.condition_tier ?? "").trim();
```

byKey key 박힌 게:
```diff
- const key = `${comparableKey}|${conditionClass}`;
+ const key = `${comparableKey}|${conditionClass}|${conditionTier}`;
```

### Step 3 — tick-pipeline.ts:4547

```diff
- await upsertRows("mvp_market_price_daily", marketRows, "date,comparable_key,condition_class");
+ await upsertRows("mvp_market_price_daily", marketRows, "date,comparable_key,condition_class,condition_tier");
```

## 효과 (다음 cron run 박힌 후)

| | Before | After |
|---|---|---|
| shoe/clothing 시세 row | condition_class 별 1개 (tier mixed) | **tier 별 별도 row** (S/A/B/C/D) |
| Polo b_grade 매물 시세 | mint 박힌 게 101k (tier 무시) | **B 박힌 tier-specific 시세** ✓ |
| 사용자 정책 Wave 715/722 | 박혀있지 X | **박힘** ✓ |
| 비교 매물 vs 시세 layer | mismatch (class vs tier) | **일관** (tier 단위) |

## 비파괴

- per-source PK 5-col (이미 박혀있음) — 박지 X
- 다른 카테고리 (전자기기 등) 박힌 conditionTier="" 박힘 (Wave 722 정책 — fashion 만 tier-aware)
- 기존 row 박힌 게 다 empty 박혀있음 — 다음 cron run 박힐 때 overwrite 박힘 (자연스럽게 갱신)
- score-worker / candidate-pool-builder 박힌 logic 변경 X

## Trade-off

- ⚠️ shoe/clothing 시세 row 박힌 게 늘어남 (tier 별 row × 5 tier = 5x)
- ✅ 정확도 ↑ (사용자 정책 Wave 715/722 박힘 정상)
- ✅ DB 박힌 사이즈 약간 ↑ (58MB → ~80MB 추정)
- ✅ Polo 같은 매물 모순 박힘 차단

## 향후 박을 거 (Step 4 — 별도 wave)

- `marketStatsByKey` 박는 logic (pack-open.ts) — condition_class 단위 박혀있는데 multiple tier row 박힐 때 race
- `selectMarketRowByCondition` 박는 fallback chain — condition_class + condition_tier 박는 게 박혀야
- query 박을 때 매물 박힌 condition_tier 박힌 row 우선 박음

## 검증 SQL (다음 cron 박힌 후)

```sql
SELECT
  condition_class, condition_tier,
  COUNT(*) AS row_count,
  MIN(active_sample_count + sold_sample_count) AS min_sample
FROM mvp_market_price_daily_per_source
WHERE date = CURRENT_DATE
  AND condition_tier IN ('S','A','B','C','D','UNKNOWN')
GROUP BY condition_class, condition_tier
ORDER BY condition_class, condition_tier;
```

기대: shoe/clothing 시세 row 박힌 게 condition_tier S/A/B/C/D 박힘 (전자기기 등 박지 X).

## 복원 가이드 (위험 신호 시)

PK rollback:
```sql
ALTER TABLE mvp_market_price_daily DROP CONSTRAINT mvp_market_price_daily_pkey;
ALTER TABLE mvp_market_price_daily ADD CONSTRAINT mvp_market_price_daily_pkey
  PRIMARY KEY (date, comparable_key, condition_class);
```

Code rollback:
```diff
+ const conditionTier = "";
- const conditionTier = (parsed.condition_tier ?? "").trim();
```

## What Not To Do

- Step 4 (marketStatsByKey) 박지 않고 끝나지 X — 박지 않으면 query 박을 때 같은 condition_class 박힌 multiple tier row 박을 때 race
- 매물 박힌 condition_class fix 박지 X (Wave 130 layer 박혀있는 것 그대로 박음, Wave 715/722 박힌 게 tier 정책)
- per-source PK 박지 X (이미 박혀있음)

## 관련 commits / PRs

- PR #52 — Wave 803g
- 영향받은 wave: Wave 722 (rollback 박은 거), Wave 886 (per-source 박은 거)

## Related Waves

- Wave 722 — Stage 5 tier-aware median (1주 박혀있던 plan)
- Wave 722 hotfix — production cron ON CONFLICT mismatch (rollback)
- Wave 803c — REVERT (정책 위반 박은 거)
- Wave 803f — daangn mixed fallback 박힐 때 DB sku_median 우선
- **Wave 803g (now)** — condition_tier tier-aware 시세 박음 (1주 plan 완료)
