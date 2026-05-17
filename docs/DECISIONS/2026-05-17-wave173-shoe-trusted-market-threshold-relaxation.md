# Wave 173 — 신발 한정 trustedMarketMedian threshold 완화

> 2026-05-17. 사용자 명령: "신발 한정 threshold 완화 (total ≥ 2)" — 운영자 풀에 신발 0건 보이는 문제 해결.

---

## 발견

Wave 172 ready 승급 직후 사용자 보고: **운영자 풀(admin-pool-browser)에 신발 0건 노출.**

진단:
- `mvp_category_readiness.shoe = ready` (01:50 KST 박힘) ✅
- tick 정상 작동 — 최근 1시간 신발 매물 386건 score됨 (max 48.5, avg 19.77) ✅
- `mvp_candidate_pool.shoe = 0건` (active/invalidated 모두 0)
- 근본 차단: `trustedMarketMedian()` (tick-pipeline.ts:2113)
  ```typescript
  if (total < 3) return null;
  if (stat.confidence === "low" && total < 5) return null;
  ```
  - 신발 daily aggregate 75 row **전부 confidence='low'** + avg_sample **1.44**, max **5**
  - → 거의 다 `trustedMedian = null` → `hasTrustedMarket = false`
- fallback batch median 도 fail: `prices.length >= 5` 필요
  - comparable_key 1,168개 중 5+ 매물 key **62개만** (474/2,463 = 19%)
  - 나머지 80%는 `skuMedian = 0` → `priceGap = 0` → `score = 0` → pool 진입 차단

즉 ready인데 시세 sample 1-2건이라 시세 비교 자체가 불가 → score 0 → pool 0건.

---

## 변경

**src/lib/tick-pipeline.ts:2113** `trustedMarketMedian` signature + 신발 한정 gate:

```typescript
function trustedMarketMedian(stat: MarketPriceRow | undefined, category?: Sku["category"] | null) {
  if (!stat) return null;
  // ... 기존 코멘트 ...
  // Wave 173 (2026-05-17): 신발 카테고리 ready 승급 직후 — daily aggregate 전부 low
  // confidence + avg sample 1.44건이라 위 gate에서 skuMedian=0 → pool 진입 0건 차단됨.
  // 사용자 결정: 신발 한정 total ≥ 2 허용 (즉시 노출 vs precision trade-off 수용).
  // outlier 보호 safety nets — Wave 171 ceiling(msrp×5) / 4 tier 가품 floor /
  // 72 광고 차단 / Wave 138 셀러당 1 pool entry / pool ceiling 동일 — 작동 중.
  // sample 1건은 outlier=시세라 여전히 차단. 2건+부터 trust.
  const active = stat.active_sample_count ?? 0;
  const sold = stat.sold_sample_count ?? 0;
  const total = active + sold;
  if (category === "shoe") {
    if (total < 2) return null;
  } else {
    if (total < 3) return null;
    if (stat.confidence === "low" && total < 5) return null;
  }
  ...
}
```

호출자 변경 (tick-pipeline.ts scoreStage:3927):
```typescript
const trustedMedian = trustedMarketMedian(marketStat, parsed?.category);
```

**reprocess 강제**:
```sql
UPDATE mvp_raw_listings r SET score_dirty = true
FROM mvp_listing_parsed p
WHERE r.pid = p.pid AND p.category = 'shoe' 
  AND p.comparable_key IS NOT NULL AND p.needs_review = false;
-- 2,178건 dirty
```

---

## 검증

- `npx tsc --noEmit` → tick-pipeline.ts 자체 에러 0건 (test/.next 사전 에러는 pre-existing)
- `npm run test:core` → **288/288 pass / 0 fail**

---

## Trade-off 수용 (사용자 명시)

| 측면 | 영향 |
|---|---|
| pool 진입 | sample 2건+ comparable_key 신발 매물 — 즉시 후보화 (예상 985건 / key 216개) |
| precision | 신발 한정 sample 2-4건 시세 = outlier 1건이 median 끌어올림 위험. madTrim도 5건 미만은 trim 안 함 |
| Wave 171 ceiling | msrp × 5 outlier 보호 작동 (NB 992 broad 236만 같은 case) |
| 가품 floor 4 tier | 0.15/0.25/0.30/0.40 ratio 차단 작동 |
| 광고 차단 72 patterns | description 광고 매물 차단 작동 |
| Wave 138 셀러 1 pool entry | 셀러당 동일 매물 다수 차단 작동 |
| LAUNCH_PLAN §12b | 정확성 우선 정책 신발 한정 예외 — 사용자 명시 승급 결정 (Wave 172) 연장선 |

---

## Safety nets (작동 중)

| 안전장치 | Wave | 상태 |
|---|---|---|
| 셀러별 1 pool entry | 138 | ✅ |
| 다중 ID 사기 그룹 차단 | 138b | ✅ |
| 가품 floor tier 1-4 (msrp × 0.15-0.40) | 141/145/152/155 | ✅ |
| 광고 차단 72 patterns | 148/153/158/163/164/165 | ✅ |
| 시세 광고 매물 제외 | 163 | ✅ |
| 시세 outlier ceiling (msrp × 5) | 171 | ✅ |
| Wave 173 신발 trust threshold (total ≥ 2) | **173** | ✅ |

---

## 다음 (모니터링)

1. **다음 tick (1-2분 안) 후 mvp_candidate_pool 신발 매물 진입 검증**
2. **사용자 카드 노출 정상 작동 확인** (관리자 + reveal modal + user dashboard 3 화면)
3. **outlier risk 모니터링** — sample 2건 매물 시세가 너무 튀면 사용자 피드백 들어올 것
4. **시세 sample 자연 누적** — medium 도달 시 자동으로 high-precision으로 복귀

---

## 다른 세션 알아볼 핵심 포인트

1. **2026-05-17 Wave 173 신발 한정 trustedMarketMedian threshold 완화** (total ≥ 2).
2. **Wave 172 ready 승급만으로는 pool 진입 X** — 시세 sample <3 또는 low+<5 gate 차단이 원인.
3. **trade-off 수용**: precision 손해 vs 즉시 노출. 사용자 결정 (AskUserQuestion 답 "B").
4. **Safety nets 7개** — Wave 171 outlier ceiling 등으로 outlier 위험 어느 정도 차단.
5. **시세 자연 누적 시 medium 도달 → 자동 복귀** (high-precision gate 재활성). 신발 한정 예외는 임시.
6. **다른 카테고리는 영향 없음** — category === "shoe" 조건만.

## Git Commits

```
[next] Wave 173: 신발 한정 trustedMarketMedian total ≥ 2 (ready 직후 pool 0건 해결)
```
