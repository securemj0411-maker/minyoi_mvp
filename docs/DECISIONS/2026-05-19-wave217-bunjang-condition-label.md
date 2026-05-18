# Wave 217 — bunjang_condition_label + resolveConditionClass 활용 (2026-05-19)

## 사용자 명시

> "근데 우리 지금 모든 카테고리 제품에 상태 분류하는데 지금 몇몇매물들 (신발 특히) 이거 등급 안붙는거같은데?? 상태 분류가 안되면 신발도 비슷한 컨디션끼리 시세비교가 안되는데??"
> "아니 씨발 우리 기존 등급 분류 안봄..?? 기존 등급제도 보고하는거맞지..??"

→ 사용자 지적 정확. 기존 인프라 활용 안 한 sloppy fix (Wave 216) 인정 + Wave 217 진짜 fix.

## 진짜 근본 원인

**1. parseFashionMobility (shoe/bag/bike/clothing) 가 `bunjang_condition_label` 무시:**

| 컬럼 | shoe 분포 | bag 분포 |
|------|----------|----------|
| `bunjang_condition_label` | NEW 1322 / LIKE_NEW 1054 / LIGHTLY_USED 1358 / HEAVILY_USED 238 / DAMAGED 3 / USED 34 | NEW 235 / LIKE_NEW 327 / LIGHTLY_USED 380 / HEAVILY_USED 57 / DAMAGED 4 / USED 15 |

총 **8000+ 매물에 bunjang 자체 등급 박혀있는데** parseFashionMobility 가 ParseInput 타입에 `bunjangConditionLabel` 필드 자체 없음. 무시.

**2. 기존 인프라 (`bunjangLabelToConditionClass` + `resolveConditionClass`) 활용 안 함:**

option-parser.ts line 133-150 / line 174 — 영어 enum → ConditionClass + worse-of 정책 다 구현돼있음. 전자기기 (option-parser.ts line 1863) 가 활용. **shoe/bag/clothing 별도 모듈은 무시.**

**3. bag tierMap 매핑 자체 없음:**

`parseFashionMobility` bag 분기 (line 390-423) 가 `parseBagOptions().conditionTier` 만 추출하고 condition_class 매핑 안 함. 코드 주석 명시 "가방/자전거는 normal 유지" (Wave 134). bag 매물 100% condition_class='normal' → 시세 grouping `(comparable_key, condition_class)` 한 bucket → 가품 + 새상품 + 사용감 시세 평균 = 망가짐.

## 측정 결과 — Wave 217 fix 검증

| 카테고리 | normal % 이전 | normal % 이후 | unopened+clean+mint % | flawed 차단 |
|---------|--------------|--------------|---------------------|-----------|
| **bag** | **100%** ❌ | **35.2%** ⭐⭐⭐ | **47.9%** | **11건** |
| **shoe** | 25% | 51.4% | 39.7% | 26건 |
| **clothing** | 51% | 41.4% | 48.0% | 12건 |

시세 daily condition_class 분리:

| 카테고리 | unopened (NEW) | mint (LIKE_NEW) | clean | normal | worn | 합계 |
|---------|---------------|----------------|-------|--------|------|------|
| **shoe** | 306 | 949 | 864 | 1047 | 519 | **3685** |
| **bag** | 12 | 28 | 56 | 185 | 53 | **334** |
| **clothing** | 31 | 25 | 81 | 72 | 44 | **253** |

같은 SKU 라도 새상품 / 새상품급 / 풀세트 / 일반 / 사용감 매물 **별도 시세** ⭐.

## 코드 변경 (3 곳)

### 1. `src/lib/parsers/wave92-fashion-mobility.ts`
- `ParseInput` 에 `bunjangConditionLabel?: string | null` 필드 추가
- `import { bunjangLabelToConditionClass, resolveConditionClass } from "@/lib/option-parser"`
- bag 분기에 shoe 와 동일 `tierMap` 추가 (s/a/b/c/reject → unopened/mint/clean/worn/flawed)
- 함수 끝에서 `resolveConditionClass(fromMeta, conditionClassResult, false)` 호출 — worse-of 정책 적용
- `PARSER_VERSION_W92` "v1" → "v2"
- `PARSER_VERSION_W216_CLOTHING` "v2" → "v3"

### 2. `src/lib/tick-pipeline.ts`
- `ScorableRawRow` type 에 `bunjang_condition_label: string | null` 추가
- `loadScorableRows` / `loadMarketStatRows` / `loadMarketStatRowsByPids` SELECT columns 에 `bunjang_condition_label` 추가
- `ensureParsedRows` — `parseListingOptions` 호출 시 `bunjangConditionLabel: row.bunjang_condition_label` 전달
- `LATEST_PARSER_VERSION_BY_CATEGORY` — shoe/bag/bike "wave92-fashion-mobility-v2" 등록 (모든 parsed 자동 re-parse trigger)

### 3. `src/lib/parsers/wave92-fashion-mobility.ts` (revert)
- 직전 잘못 박은 `parseConditionTier` 정규식 추가 (정품 미확인/가품 의심/구제 상품 등) 다 revert.
- 기존 `bunjangLabelToConditionClass` 인프라 사용이 정답. 별도 정규식은 sloppy.

## reparse 결과 (`scripts/reparse-wave217-fashion.ts`)

- **shoe**: 8964 fetch / 8964 parsed / 6859 usable (76.5%) — condition_class normal 51.4% / mint 20.8% / clean 13.8% / worn 8.6% / unopened 5.1% / flawed 0.3%
- **bag**: 1379 fetch / 1379 parsed / 301 usable (21.8%) — condition_class normal 35.2% / clean 25.7% / worn 16.2% / mint 15.2% / unopened 7.0% / flawed 0.8%
- **clothing**: 1719 fetch / 1719 parsed / 1709 usable (99.4%) — condition_class normal 41.4% / clean 30.7% / mint 11.7% / worn 10.0% / unopened 5.6% / flawed 0.7%

## market_invalidation enqueue + force-trigger

```sql
INSERT INTO mvp_market_key_invalidation 
  (comparable_key, source, reason, priority, status, ...)
SELECT DISTINCT comparable_key, 'wave217_metadata_condition', 
  'bunjang_condition_label + resolveConditionClass 적용 후 시세 재계산', 100, 'pending', ...
FROM mvp_listing_parsed
WHERE category IN ('shoe', 'bag', 'clothing') 
  AND comparable_key IS NOT NULL
  AND parse_confidence >= 0.65 AND needs_review = false;
```

→ shoe 3269 + bag 239 + clothing 120 = **3628 keys** enqueue (priority 100, last_event_at = epoch).

`force-market-stats-wave216.ts` 20 passes 호출 → 다 done (status 분포 shoe 3895 / bag 419 / clothing 146).

## verify

- test:core **556/556 pass** ✅
- shoe / bag / clothing 시세 daily condition_class 5분리 확인 ✅
- bag normal 비율 100% → 35.2% (가장 큰 fix) ✅

## 자기 평가 (Wave 216 sloppy fix 인정)

Wave 216 에서 clothing parser 분기 추가 + brand 구분 했지만 **기존 인프라 (`bunjangLabelToConditionClass` / `resolveConditionClass`) 활용 안 함**. 전자기기 (option-parser.ts 본문) 가 이미 사용하는데 shoe/bag/bike/clothing 별도 모듈 (parseFashionMobility) 은 무시. 사용자 지적 ("기존 등급제도 보고하는거맞지") 받고서야 발견.

또 Wave 217 첫 시도에서 `parseConditionTier` 에 한국어 정규식 8+ 추가하려 했음 (구제 상품 / 빈티지 / 정품 미확인 등). 사용자 화내고서야 잘못된 방향 인정 — 기존 메타데이터 8000+ 매물 있는데 새 정규식 박는 거 sloppy. revert + 기존 인프라 활용으로 정정.

다음 wave 부터: **새 정규식/heuristic 박기 전에 기존 인프라 검토**. ParseInput type / option-parser.ts 본문 / extractConditionClass / resolveConditionClass / bunjangLabelToConditionClass — 다 살펴보고 fix 박기.

## 다음 자연 처리

- score-stage 자연 cron 누적 처리 → 매물 score 재산정 (새 condition_class 별 시세 기준)
- candidate-pool-builder → 새 시세 분리로 더 정확한 차익 계산 + 사용자 풀 진입

## decision log

이 파일 push 후 사용자에 정직한 보고.
