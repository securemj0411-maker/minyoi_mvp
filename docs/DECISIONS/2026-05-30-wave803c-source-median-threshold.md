# Wave 803c — per-source 시세 fallback bug fix

## 사용자 보고

> "Acne Studios 패턴 셔츠 50사이즈 — 시세 230,000원
> 비교 매물 4개 B급 매물끼리만: 200k / 67k / 65k + 1개 더
> 어떻게 비교 매물에 20만 초과가 없는데 시세가 23만? 통합 중나나 번장 통합시세로 fallback 된 거야 뭐야 당근 매물인데?"

→ 사용자 추측 100% 맞음. 통합 시세 fallback 박혀서.

## 진단

### 매물 정보 (DB 검증)
- pid: 9002503803331
- comparable_key: `clothing|acne_shirt|shirt|b_grade`
- condition_class: clean
- condition_tier: B
- source: daangn
- sku_median (DB): **184,000** ← score-worker 박은 거
- 사용자 화면 시세: **230,000** ← pool API marketBasis (DB 와 다름)

### per-source 시세 데이터 (오늘)

| Source | condition_class | active_median | blended | sample |
|---|---|---|---|---|
| bunjang | clean | 250k | **230k** | 4 |
| bunjang | normal | 120k | 110k | 2 |
| bunjang | worn | 250k | 230k | 1 |
| **daangn** | **clean** | 200k | **184k** | **2** ⚠️ |
| daangn | normal | 130k | 119k | 3 |

### 통합 시세
| condition_class | blended | sample |
|---|---|---|
| clean | **230k** | 4 |
| normal | 110k | 2 |
| worn | 230k | 1 |

### Root cause — `sourceAwareMedian` threshold

`src/app/api/packs/pool/route.ts:568`:
```typescript
if (!row || sourceSampleCount < 3) return null;
```

- daangn clean sample = **2** → `< 3` → NULL
- NULL → 통합 시세 fallback → bunjang clean dominant → **230k 박힘** (사용자 화면)

비교 매물 logic (`comparable_key + source filter`) 은 source filter 정상 박힘 → daangn 매물만 보여줌 (200/67/65k).

→ **시세는 통합 fallback, 비교 매물은 daangn 만 → 모순**.

## Fix

```diff
- if (!row || sourceSampleCount < 3) return null;
+ if (!row || sourceSampleCount < 2) return null;
```

threshold 3 → 2:
- sample=2 도 source-specific 시세 박음 (단일 outlier 보다 평균 안전)
- sample=1 (단일 매물) 면 여전히 NULL → 통합 fallback (안전 마진)

## 효과

| 사용자 매물 | Before | After |
|---|---|---|
| Acne 셔츠 (daangn clean sample=2) | 시세 230k (통합) | **시세 184k (daangn)** ✓ |
| sku_median (DB) | 184k | 184k (불변) |
| 비교 매물 (daangn 200/67/65k) | daangn 만 | daangn 만 (불변) |
| 시세 vs 비교 매물 일관성 | ❌ 모순 | ✅ 일관 |

## 비파괴 보장

- per-source 시세 정상 박힌 경우 (sample≥3) 동일 작동
- fallback logic 그대로 (sample<2 만 적용)
- score-worker 의 `mvp_listings.sku_median` 박는 logic 무관 (별도)
- 비교 매물 logic 변경 X
- `pickByConditionFallback` 변경 X (condition_class 매칭 fallback 그대로)

## Trade-off

- ⚠️ sample=2 표본 적어 시세 변동성 ↑ (n=2 라 outlier 영향 크)
- ✅ 통합 fallback 보다 source 일관성 우선 (사용자 mental model)
- ✅ sample=1 여전히 fallback (단일 매물 outlier 위험 차단)
- ✅ 사용자 보고와 정확히 매칭 — '당근만' filter 박힌 사용자는 당근 시세 박혀야 함

## 향후 개선 (별도 wave)

- fallback 박힐 때 UI 라벨 "통합 시세 박힘 (당근 표본 부족)" 추가 — 정직성
- score-worker 의 `sku_median` 박는 logic 도 source-aware 확인 (현재 박혀있는지 검증)
- sample=1 도 박을 만한지 검토 (현재는 안전 위해 fallback)

## 검증

배포 후:
1. Acne 셔츠 (`9002503803331`) → 시세 **184k** 박힘 (이전 230k)
2. 비교 매물 (daangn 200/67/65k) 과 일관성 ✓
3. 다른 daangn clean sample=2 매물도 source-specific 시세 박힘
4. sample=1 매물은 여전히 통합 fallback (안전)

```sql
-- 검증 SQL: daangn sample=2 매물 박힌 row 분포
SELECT
  comparable_key,
  condition_class,
  active_sample_count + sold_sample_count AS total_sample,
  blended_median_price
FROM mvp_market_price_daily_per_source
WHERE source = 'daangn'
  AND date = CURRENT_DATE
  AND (active_sample_count + sold_sample_count) BETWEEN 1 AND 3
ORDER BY total_sample, comparable_key
LIMIT 50;
```

## 복원 가이드

문제 발생 시 1줄 revert:
```diff
- if (!row || sourceSampleCount < 2) return null;
+ if (!row || sourceSampleCount < 3) return null;
```

또는 사용자 보고 다시 받기 시작하면 threshold 4 박음 (더 보수적).

## What Not To Do

- threshold 0 또는 1 박지 X — 단일 매물 outlier 위험 (sale 가격 1개로 시세 박힘)
- 통합 fallback 자체 제거 X — sample 없는 매물은 통합으로 fallback 박혀야 (시세 미표시 보다 나음)
- 비교 매물 logic 도 통합으로 박지 X — 사용자 의도 ('당근만' 박으면 당근 매물만 보임) 반대
- `pickByConditionFallback` 변경 X — condition_class 매칭 fallback 별도 logic

## 관련 commits / PRs

- PR #48 — Wave 803c per-source 시세 threshold fix
- 영향받은 wave: Wave 886 (당근 전용 시세 source split)

## Related Waves

- Wave 886 — 당근 전용 시세 (source split market stats) 도입
- Wave 722 — Stage 5 tier-aware median
- Wave 803b — '당근만' filter 매물 누락 fix
- **Wave 803c (now)** — per-source 시세 fallback threshold fix
