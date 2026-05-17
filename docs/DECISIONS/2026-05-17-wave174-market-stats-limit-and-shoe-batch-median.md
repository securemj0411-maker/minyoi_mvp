# Wave 174 — marketStatsLimit 800→3000 + 신발 fallback batch median 5→2

> 2026-05-17. Wave 173 trustedMedian 완화 후에도 운영자 풀 신발 0건 잔존. 진짜 원인 재진단 후 두 갈래 fix.

---

## 발견

Wave 173 검증 (4분 후 ScheduleWakeup):
- mvp_candidate_pool 신발 = **여전히 0건**
- tick 정상 작동 (신발 28건 score, max 31.5)
- **priceGap = 0 (28/28)** → score는 velocity+safety만으로 ~30점
- score_dirty 처리 진행 중 (2,178 → 1,807)

### 진짜 근본 원인 = 시세 daily 자체에 신발 매물 거의 없음

| 측정 | 값 |
|---|---|
| 신발 raw active 매물 | 2,070 (24h recent 1,975) |
| 신발 parsed needs_review=false | 2,182 |
| 신발 listing group (model+size+condition_class) | 1,073 |
| 시세 daily 신발 row (current_date) | **36** |
| 매물 매칭 가능 group | **18 / 1,073 = 1.7%** |
| 매물 단위 매칭 | **38 / 2,168 = 1.7%** |

전 카테고리 비교:
| Category | daily_keys | parsed_keys |
|---|---|---|
| smartphone | 100 | 3,023 |
| tablet | 51 | 2,825 |
| smartwatch | 69 | 2,772 |
| earphone | 56 | 2,507 |
| **shoe** | **36** | **2,182** |
| laptop | 10 | 1,177 |

### 원인: market-worker `PIPELINE_MARKET_STATS_LIMIT = 800` (전 카테고리 share)

- market-worker 1시간 주기 (마지막 02:11 KST)
- 전 카테고리 14K+ 매물 → 800건 limit → 신발 30-40 row만 daily에 박힘
- Wave 156 sweep 깊게 (pageCount 1→15)로 신발 매물 2,182건 들어왔지만 시세 누적 안 따라옴
- Wave 173 trustedMedian total≥2 완화는 코드 정상이지만 작동할 시세 row 자체 부족

---

## Fix

### Fix A: marketStatsLimit default 800 → 3000

**src/lib/pipeline-config.ts**:
```typescript
// Wave 174 (2026-05-17): 800 → 3000 — Wave 156 신발 sweep 깊게 (2,182건 매물) 이후
// 전 카테고리 14K+ 매물 중 시세 daily 박힘 비율 1.7-3.3% 머무름. 신발 ready 승급(Wave 172) +
// trustedMedian total≥2 완화(Wave 173) 했는데도 시세 daily 36 row만 → pool 0건.
// 한 tick 4-5초 → 15-20초로 늘어남 (maxDuration 60초 한도 안).
marketStatsLimit: envInt("PIPELINE_MARKET_STATS_LIMIT", 3000, 100, 10000),
```

영향:
- market-worker 한 run에서 3,000건 매물 처리 → 전 카테고리 시세 coverage 3-4배 향상
- 신발 매물 1,073 group 중 절반 이상 시세 daily 박힘 예상 (1.7% → ~50%)
- tick duration 4-5초 → 15-20초 (maxDuration 60초 한도 안)

### Fix B: 신발 한정 fallback batch median threshold 5 → 2

**src/lib/tick-pipeline.ts scoreStage:3952**:
```typescript
// Wave 174 (2026-05-17): 신발 한정 batch median threshold 5 → 2 — Wave 173 trustedMedian
// 완화에도 신발 시세 daily coverage 1.7%라 priceGap=0 → pool 0건. 같은 batch 안 동일
// marketKey 매물 2건+ 시 batch median 사용. outlier 위험은 Wave 171 ceiling(msrp×5) +
// 가품 floor 4 tier + 광고 차단 72 patterns + 셀러당 1 pool entry safety nets로 차단.
const fallbackThreshold = parsed?.category === "shoe" ? 2 : 5;
const fallbackMedian = prices.length >= fallbackThreshold ? madTrim(prices).medianValue : 0;
```

영향:
- scoreStage가 같은 marketKey 매물 2건+ 모이면 batch median으로 priceGap 계산
- 시세 daily 누락 SKU도 즉시 후보화 가능
- madTrim은 5건 미만 trim X → sample 2건은 outlier 1건이 median 결정 위험. 단 safety nets 작동

---

## 검증

- `npx tsc --noEmit` → 두 변경 파일 에러 0건
- `npm run test:core` → **288/288 pass / 0 fail**

---

## Trade-off 정리 (사용자 명시 동의, Wave 172 결정 연장선)

| 측면 | 영향 |
|---|---|
| 시세 daily coverage | 1.7% → ~50%+ (Fix A) |
| batch median fallback | 신발 한정 2건+ (Fix B) — 즉시 후보화 |
| tick duration | 4-5초 → 15-20초 (Fix A) |
| Precision (신발 한정) | 손해 — sample 2건 outlier 1건이 median 결정 가능 |
| Wave 171 ceiling | msrp × 5 outlier 매물 진입 차단 ✅ |
| 가품 floor 4 tier | 0.15/0.25/0.30/0.40 ratio 차단 ✅ |
| 광고 차단 72 patterns | description 광고 매물 차단 ✅ |
| Wave 138 셀러 1 pool entry | 동일 셀러 다수 차단 ✅ |
| LAUNCH_PLAN §12b | 신발 한정 예외 (Wave 172/173 연장선) |
| 다른 카테고리 | 영향 X (fallback threshold 5 유지) — Precision 정책 그대로 |

---

## 다음 (검증)

1. dev server hot reload → 다음 tick에서 marketStatsLimit 3000 적용
2. 다음 market-worker run (1시간 주기, 03:22 KST 예상) 또는 manual trigger
3. mvp_market_price_daily 신발 row 카운트 증가 확인
4. mvp_candidate_pool 신발 진입 검증 (priceGap > 0 매물)
5. 사용자 카드 3 화면 (admin-pool-browser + pack-reveal-modal + user-reveal-dashboard) 노출 확인
6. outlier risk 모니터링 — sample 2-3건 매물 시세 튀면 사용자 피드백

---

## 다른 세션 알아볼 핵심 포인트

1. **2026-05-17 Wave 174**: marketStatsLimit 800→3000 + 신발 fallback batch median 5→2.
2. **Wave 172 ready / Wave 173 trustedMedian 완화로는 부족했음** — 시세 daily 자체 coverage 1.7%가 진짜 원인.
3. **신발 한정 batch threshold** — 다른 카테고리는 strict 5 유지 (precision 정책).
4. **safety nets 7개** + Wave 174 두 fix = pool 진입 + outlier 차단 균형.
5. **tick duration 15-20초** — maxDuration 60초 한도 안. 그래도 시간 모니터링 필요.

## Git Commits

```
[next] Wave 174: marketStatsLimit 3000 + 신발 batch median 2 (시세 daily coverage fix)
```
