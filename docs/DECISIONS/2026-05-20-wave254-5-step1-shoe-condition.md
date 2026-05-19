# Wave 254.5 step 1 (2026-05-20) — shoe conditionFromTextFashion 통합

## 발단

사용자 매물 pid 408858108 가젤 볼드: "새상품 + 약간 하자가있어" → mint 잘못.

Wave 254.2 영역2 root cause 확정 — fashion (shoe/bag/clothing) parser 가 Wave 203~209 의 canonical `conditionFromText` 미사용. parseListingOptions:1660 에서 fashion 직행 → parseFashionMobility 가 `parseConditionTier` (regex-only, negation 미지원) 만 사용.

추가 누락:
- `cosmetic_wear` negation ("사용감 적음" → 정상인데 worn 박힘)
- `repair_or_defect_signal` negation ("하자 없음" → 정상인데 flawed 박힘)
- objective signal override (Wave 209)
- `buying_post` ("구함" 매물 차단 — Wave 204)
- `single_side_only` (earphone 만 — 신발은 무관)
- `accessory_compatible_for_other_product` ("X용 액세서리" — 잘못된 SKU 매칭 차단)

사용자 결정 (Wave 254.5 옵션 a, 점진 rollout): **shoe → bag → clothing**, parser v7 → v8.

## 변경 (additive, 비파괴)

### 1. `src/lib/option-parser.ts`

- `CONDITION_RANK` export 추가 (fashion parser 도 worst-of merge 에 사용).
- 새 export 함수 `conditionFromTextFashion(text, category)`:
  - 내부적으로 `conditionFromText(text, null, null, null)` 호출 — Wave 203~209 정책 자동 적용.
  - shoe-specific signals 추가 (현재 step 1):
    - `shoe_sole_crumbling` (-0.25) — 솔 가루/미드솔 가루/아웃솔 가루 + negation
    - `shoe_hydrolysis` (-0.3) — 가수분해/hydrolysis + negation
    - `shoe_insole_missing` (-0.15) — 인솔 빠짐/깔창 분실
    - `shoe_heel_worn_severe` (-0.15) — 굽창 마모 심함/뒷굽 다 닳
    - `shoe_sole_separation` (-0.25) — 밑창 분리/본드 붙임
  - 위 3 개 (sole_crumbling, hydrolysis, sole_separation) 는 `repair_or_defect_signal` piggy-back → FLAWED 분류 보장.
  - bag/clothing 분기 자리 잡음 (step 2/3 에서 채울 예정).

### 2. `src/lib/parsers/wave92-fashion-mobility.ts`

- 새 constant `PARSER_VERSION_W92_SHOE_V8 = "wave92-shoe-v8"`.
- import: `conditionFromTextFashion`, `extractConditionClass`, `CONDITION_RANK`.
- `parseFashionMobility` scope-level state 추가: `fashionConditionScore`, `fashionConditionNotes`.
- **shoe 분기 내부** (other branches unchanged):
  - `conditionFromTextFashion(text, "shoe")` 호출.
  - `extractConditionClass(fashion.conditionNotes)` → notes-based ConditionClass.
  - **worst-of merge** with existing tier-based `conditionClassResult`:
    - normal/low_batt 인 쪽은 무시 (실제 signal 없음 — 의미 없는 demote 차단).
    - `CONDITION_RANK` 기준 낮은 등급 우선 (Wave 130 보수적 정책).
  - **needsReview 보강**: `buying_post` / `single_side_only` / `accessory_compatible_for_other_product` / `parts_only` → `criticalUnknown.push("shoe_strong_negative_signal")`.
  - `parsedJson.shoe_condition_notes`, `shoe_condition_score_fashion`, `shoe_fashion_condition_applied` 박힘 (운영자 추적용).
- **score merge**: `conditionScore = Math.min(tierScore, fashionScore)` — Wave 209 objective override 원칙.
- **conditionNotes 반환**: `[]` (Wave 130 default) → `fashionConditionNotes` (shoe 만 채움; bag/bike/clothing 은 빈 배열 유지).
- **parserVersion 반환**: shoe → `PARSER_VERSION_W92_SHOE_V8` ("wave92-shoe-v8"). bag/bike → unchanged ("wave92-fashion-mobility-v7"). clothing → unchanged ("wave216-clothing-v7").

### 3. `src/lib/tick-pipeline.ts`

- `LATEST_PARSER_VERSION_BY_CATEGORY.shoe`: `"wave92-fashion-mobility-v7"` → `"wave92-shoe-v8"`.
- bag/bike unchanged (step 2/3 까지).
- 결과: shoe 매물 11,481건 (v3 9,115 / v7 1,537 / v2 659 / v4 170) 모두 stale 표시 → 자연 re-parse via cron (`isParsedStale` 체크).

### 4. `tests/wave254-5-fashion-condition.test.ts` (신규)

- 20 tests pass:
  - Wave 203~209 base 정책 5 tests (repair_or_defect_signal + negation + cosmetic_wear negation + buying_post + good_condition)
  - shoe-specific signals 6 tests (5 signals + 1 negation)
  - parseListingOptions integration 7 tests (pid 408858108 시뮬레이션 + 정상 매물 + conditionNotes 비어있지 않음 + parser_version 3개 카테고리 + needsReview)
  - worst-of merge 2 tests
- `test:core` 회귀: 624 pass / 11 fail (모두 pre-existing `/me` UI tests, Wave 254.3 baseline 동일).

## 효과 (예상)

### 즉시 (deploy 후 자연 re-parse)

- shoe 매물 11,481건 → parser_version stale → cron 이 자동 re-parse:
  - v3 (9,115) → v8 (가장 큰 영향, 모두 옛 wave92-v3 인 매물)
  - v7 (1,537) → v8
  - v2 (659) → v8
  - v4 (170) → v8

### 사용자 매물 pid 408858108 가젤 볼드

- 기존: parseConditionTier "새상품" → a_grade → mint (잘못)
- fix 후: conditionFromTextFashion 의 "약간 하자가있어" → repair_or_defect_signal → flawed
- worst-of: flawed (rank 0) vs mint (rank 4) → **flawed** ✅

### systemic 영향 — 다른 신발 매물

- "사용감 적음 / 거의 새것" 명시 매물 — cosmetic_wear 잘못 박힘 fix (Wave 209 negation 정책).
- "구함 / 삽니다" buy-intent 신발 매물 — buying_post → FLAWED + POOL_BLOCK + COMPARABLE_EXCLUDE 자동 차단 (Wave 204).
- "솔 가루 / 가수분해 / 밑창 분리" 매물 — FLAWED 정확 분류 (기존 reject 누락 케이스 + 새 신호).
- bunjang condition label (영어 enum DAMAGED/HEAVILY_USED/USED 등) 정확 활용 (이미 Wave 217 박혀있음, 동작 확인).

## risk 평가

- 점진 rollout — bag (1,485건 v3+v7) / clothing (4,422건 v3+v7) 영향 X (step 2/3 까지).
- Wave 254.4 (production cron stuck) — 만약 cron 멈춰있다면 즉시 효과 없음. cron 회복 시 자연 re-parse.
- 매뉴얼 trigger rematch 안 함 (destructive UPDATE — 사용자 승인 필요 정책).

## 미완 (다음 step / wave)

- **Wave 254.5 step 2 — bag**: parser v7 → v8. shoe 와 동일 path (conditionFromTextFashion).
  - bag-specific signals 추가: 내피 끈적 / 가죽 까짐 / 모서리 헤짐 / 페인팅 벗겨짐.
- **Wave 254.5 step 3 — clothing**: parser v7 → v8.
  - clothing-specific signals: 보풀 / 색바램 / 늘어남 / 핏 변형 / 인쇄 갈라짐.
- **Wave 254.4 — production cron stuck 진단** (별도 wave, 코드 변경 무관):
  - mvp_detail_queue done/failed/pending newest_update ~ 2026-05-19 20:09 (9h+ stale)
  - Vercel cron status / detail-worker 가동 여부 확인 필요.
- **사용자 매물 pid 408858108 production 검증**: cron 회복 후 → /me 진입 → conditionClass=flawed + 시세 비교 정확 표시.
