# Wave 766 — 의류 deep spread audit (다중 brand 묶음 + outlier 패턴)

**날짜**: 2026-05-24
**Wave**: 766 (사용자 #6 보고: "의류 deep sweep 더 깊게")
**Owner**: Claude

## 사용자 요청

"의류 deep sweep 더 깊게 해야되는 거 아닌가?"

지난 Wave (765) 는 ready pool 105건만 검사. 사용자 의견대로 **raw parsed 전체 12K+ 매물 deep audit**.

## 진행

### Step 1: Brand vs SKU 매칭 audit (지난 30일 의류 12,000+ 매물)

- 12K+ 매물 중 **5건 (0.04%) brand mismatch** = brand 매칭은 거의 perfect
- 의심 brand 별: polo 1 / bape 1 / rrl 1 / stone_island 1 / nike 1 — 무시 가능

→ **brand 자체 매칭은 깨끗** (Wave 762-765 fix 효과).

### Step 2: SKU 내부 spread audit (같은 comparable_key 가격 차이)

Top spread (n>=10):
| comparable_key | n | spread | min | max |
|---|---|---|---|---|
| polo_apparel_broad\|shirt\|c_grade | 18 | **239x** | 23K | 5,500K |
| thombrowne_knit\|knit\|b_grade | 12 | **82x** | **7.9K** | 650K |
| polo_knit_sweater\|knit\|b_grade | 89 | 73x | 13K | 950K |
| polo_apparel_broad\|jacket\|b_grade | 25 | 44x | 34K | 1,500K |
| polo_rrl\|unknown_condition | 35 | 42x | 63K | 2,660K |

### Step 3: Outlier 매물 직접 조사

발견된 4가지 핵심 outlier 패턴:

**1) 가품 의심 (premium brand 비현실적 저가)**
- pid 409843513: "톰브라운/여성용/캐주얼니트/상태A" **7,900원** — 톰브라운 정품 최소 100K
- acne 매물 15K 1건 — "아크네 니트 스웨터" 정체 모호

**2) 다중 brand 묶음 매물 (사용자 #4 가 본 패턴)**
- pid 7000581033510: "얀13 니트조끼 / 오일릴리 랑방 지컷 아크네 듀엘 자라" 25K → 6개 brand 명시
- 단품 시세 비교 무의미

**3) Polo sub-line 변형 (Wave 764 차단 누락)**
- "폴로진스 빈티지" — Wave 764 의 "polo jeans company" 안 잡힘 (띄어쓰기 없음)
- "Z Pattern Knitted Polo" — Z Pattern 보세 brand

**4) 캐시미어 100% (Wave 764 띄어쓰기 순서 미스)**
- 매물 "캐시미어 100프로" — Wave 764 의 "100프로 캐시미어" 와 순서 반대

## Fix

### 1. `catalog-712b-bias-free.ts` polo_knit_sweater mustNotContain 보강

```typescript
"폴로진스", "polo jeans", "폴로 진스", "polo sport", "폴로 스포츠",
"z pattern", "z패턴", "zpattern",
"얀13", "yan13", "오일릴리", "오일 릴리", "oilily", "지컷", "g cut", "g-cut", "듀엘", "duel",
// 캐시미어 100% 변형 순서.
"캐시미어 100프로", "캐시미어100", "100캐시미어",
```

### 2. `wave92-fashion-mobility.ts` parseClothingOptions — 다중 brand 묶음 detection

```typescript
const brandSignals = [
  /bape|베이프|에이프/, /polo|폴로|랄프/, /stussy|스투시/, /arcteryx|아크/,
  /moncler|몽클레/, /thom.*browne|톰브라운/, /supreme|슈프림/, /acne|아크네/,
  /carhartt|칼하트/, /uniqlo|유니클로/, /자라|zara/, /오일릴리|oilily/,
  /지컷/, /랑방|lanvin/, /듀엘|duel/, /얀13/, /타미|tommy/, /라코스테|lacoste/,
];
const matchedBrandCount = brandSignals.filter((re) => re.test(title)).length;
const multiBrandBundle = matchedBrandCount >= 3;  // 3+ brand = 묶음 거의 확실
```

reason 분기: `clothing_multi_brand_bundle` / `clothing_multi_size_bundle` / `clothing_multi_item_bundle`.

### 3. PARSER_VERSION bump

`wave216-clothing-v50` → `wave216-clothing-v51`. drift gate trigger.

## 검증

`/tmp/wave766-multi-brand-test.ts` — 5/5 pass:
- 6 brand 묶음 ("얀13/오일릴리/랑방/지컷/아크네/듀엘/자라") → block ✓
- 3+ brand 비교 매물 → block ✓
- 단일 brand 매물 → pass ✓
- 2 brand collab ("슈프림 노스페이스 발토로") → pass ✓ (정상 collab false positive 안 잡음)
- 묶음 2개 일괄 → block ✓ (기존 패턴)

## DB 즉시 처리

```sql
UPDATE mvp_candidate_pool SET status='invalidated', invalidated_reason='wave766_clothing_outlier_or_fake_floor'
WHERE category='clothing' AND status='ready' AND
  ((comparable_key LIKE '%thombrowne%' AND price < 30000)
   OR (comparable_key LIKE '%moncler%' AND price < 100000)
   OR (comparable_key LIKE '%acne%' AND price < 20000)
   ...);
```

결과: 0건 invalidate — ready pool 에 이미 outlier 없음 (이전 fix 들 효과). Outlier 는 시세 sample 로만 들어가던 매물들 → catalog/parser fix 로 향후 차단.

## 영향

- 다중 brand 묶음 매물 자동 reject (지난 30일 12K+ 의류 매물 중 패턴 발견되면 모두 needsReview)
- Polo sub-line / Z Pattern / 얀13 등 보세 brand 차단 강화
- 톰브라운/아크네 가품 의심 floor 가격 (수동 SQL 차단 시도 — 현재 ready 0건)

## 미해결 (추후)

- **Brand별 min price floor 정책** (parser 단계) — 톰브라운 < 50K reject 같은 sanity check. 별도 wave (정책 결정 필요).
- **broad SKU (polo_apparel_broad / polo_rrl) spread 239x / 42x** — narrow split 필요 (별도 wave).
- **시세 sample 정리** — `mvp_market_price_daily` 의 outlier comparable_key 정리 (자연 만료).

## 관련 commit

- `8f53bc3d`: Wave 765 — BAPE 통합 + Polo 보이즈 + multi-size detection
- 본 commit: Wave 766 — 다중 brand 묶음 + 폴로진스/캐시미어 100프로 변형
