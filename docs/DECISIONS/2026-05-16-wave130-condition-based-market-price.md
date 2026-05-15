# Wave 130 — L2 condition별 시세 별도 트래킹 (사업 보고서 retention factor)

> 사업 보고서 L2: "같은 SKU+옵션 매물도 condition별 시세 spread 크다. 끼리 비교하면 더 정확". 측정 결과 spread 15~40% 확인 → 큰 작업 진행.

## 1. 시간 + 동기
- 2026-05-16 진행 (이전 Wave 129 commit fc9e929 후속)
- 사용자 명령: "L2 존나 중요해보이는데?? 우리 이걸로 하자나 이런거 다 하자 끼리 비교하고 엄청 나질수 있을듯??"
- "근데 대충하지말고 우리 코드 존나 폭넓게 깁게 살피고 로그 무조건 남기셈"

## 2. 발견 (DB 측정)
```sql
-- 같은 comparable_key 내 condition별 가격 spread
airpods_max|usbc: mint 550K vs worn 430K (22% 차이)
airpods_4_anc|usbc: mint 210K vs normal 150K (40% 차이)
airpods_pro_2_usbc: mint 170K vs worn 170K (거의 같음 — varies by SKU)
airpods_max|lightning: mint 350K vs worn 300K (17%)
```
같은 모델이라도 condition별로 시세 큰 차이. 기존 시스템은 일부 condition을 hard filter로 제외 + 나머지 mixed average → 사용자 매물 condition 미반영.

## 3. 변경
### 3a. DB Schema migration
- `mvp_listing_parsed.condition_class` 컬럼 추가 (text, default 'normal')
- `mvp_market_price_daily` PK: `(date, comparable_key)` → `(date, comparable_key, condition_class)`
- `mvp_market_velocity_daily` PK 동일 변경 (legacy 'all' default 유지 — velocity는 후속 wave에서 condition 분리)
- `mvp_candidate_pool.condition_class` 컬럼 추가
- 기존 row backfill: condition_notes에서 derive
- 분포: clean 6,242 / flawed 4,689 / mint 3,713 / normal 3,482 / worn 2,714 / low_batt 317

### 3b. Code (10 files)
- **`src/lib/option-parser.ts`**:
  - `ConditionClass` type + `extractConditionClass()` 함수 신규 (5-class + flawed)
  - 우선순위: flawed > mint > low_batt > clean > worn > normal
  - `parseListingOptions` return에 `conditionClass` 추가
  - `parsedJson.condition_class` 박음
  - `toParsedListingRow` 에 `condition_class` 박음
- **`src/lib/parsers/wave92-fashion-mobility.ts`**: `conditionClass: "normal"` default (fashion은 condition 추출 미구현)
- **`src/lib/tick-pipeline.ts`**:
  - `ParsedListingRow.condition_class` 추가
  - `loadParsedRows`/`loadParsedRowsByComparableKeys`/`ensureParsedRows` 모두 condition_class fetch
  - `upsertMarketPriceDaily`: condition_notes hard filter (Wave 90/91/106) → condition_class grouping
    - flawed: 시세 산정 차단 (현재 정책 유지)
    - accessory_bundle/multi_device_bundle: 차단 유지 (단품 시세 noise)
    - mint/clean/normal/worn/low_batt: 각각 별도 row로 시세 산정
  - grouping key: `${comparable_key}|${condition_class}`
  - `upsertRows` conflict key: `date,comparable_key,condition_class`
  - `loadMarketPriceStats`: condition 별 row 모두 fetch → `Map<comparable_key, Map<condition, row>>`
  - `pickMarketStatByCondition()`: 매물 condition에 매칭되는 row 선택 + fallback chain
  - score 단계: 매물 condition_class로 시세 매칭 → trustedMedian / skuMedian 정확도 ↑
- **`src/lib/pack-open.ts`**:
  - `RevealMarketBasis` type 확장: `conditionClass`, `conditionLabel`, `fallbackUsed`, `otherConditions[]`
  - `MarketStatsMap` 타입: `Map<comparable_key, Map<condition_class, row>>`
  - `MarketPriceRow.condition_class` 추가
  - `fetchLatestMarketStats`: condition별 모든 row fetch
  - `fetchPoolConditionClassByPids`: candidate_pool에서 condition_class batch fetch (RPC 변경 회피)
  - `selectMarketRowByCondition()`: condition 매칭 + fallback (target → adjacent → all)
  - `marketBasisForCandidate`: conditionClass parameter 추가, otherConditions 채움
- **`src/lib/candidate-pool-builder.ts`**:
  - `PoolParsedInput.condition_class` 추가
  - pool entry에 `condition_class` 박음 (profit 계산 + pack open 시 매칭 시세 조회)
- **`src/app/api/packs/me/route.ts`**: parsedRows fetch에 condition_class 추가, marketBasisForCandidate에 conditionClass 전달
- **`src/app/api/listings/[pid]/market-source/route.ts`**: parsed query + marketStats query condition_class 매칭
- **`src/lib/landing-showcases.ts`**: parsed/market fetch condition aware + fallback
- **`src/components/pack-reveal-modal.tsx`**: `MarketBasisMini` hero block에 conditionLabel badge + fallbackUsed 표시 + otherConditions 비교 chip ("동일 모델 다른 등급 시세")
- **`src/components/user-reveal-dashboard.tsx`**: fallback marketBasis empty default 필드 추가

### 3c. Test
- **`tests/wave130-condition-class.test.ts`** 신규: 13 케이스 (우선순위/null safe/multi-flag)

## 4. 검증
- 152/152 test pass (139 기존 + 13 신규) ✓
- tsc clean (`.next/dev/types/validator.ts` 무관한 build artifact 에러만)
- DB 검증:
  - `mvp_listing_parsed`: 21,157 rows 분류 완료
  - `mvp_market_price_daily` PK = (date, comparable_key, condition_class)
  - `mvp_market_velocity_daily` PK 동일
- 다음 market-worker tick (10분 후)부터 condition별 row 자동 생성

## 5. 위험
### 5a. legacy 'all' row 잔존
- 기존 시세 row는 condition_class='all'로 백필됨 (mixed average 의미)
- 다음 daily tick에서 condition별 row 새로 생성 → 'all' row는 date 옛 → 자연 expire
- `selectMarketRowByCondition`/`pickMarketStatByCondition` fallback chain에 'all' 포함 → 신규 condition row 없으면 'all' 사용 (graceful degradation)

### 5b. RPC 시그니처 미변경
- `reserve_mvp_pool_candidates` RPC는 condition_class 미반환 (CLAUDE.md "RPC 변경 시 5종 정합성 동시 검증" 정책)
- 별도 batch fetch `fetchPoolConditionClassByPids`로 lookup (1 round trip 추가)
- 후속 wave에서 RPC 시그니처 변경 검토 가능 (return field 추가는 race 영향 X, 호출자 호환만 확인)

### 5c. velocity_daily는 'all'로 통합 유지
- `mvp_market_velocity_daily` PK도 condition_class 포함했지만 `scripts/sync-market-velocity.mjs`는 미변경 (default 'all')
- 회전 시간은 condition별 차이 작을 가능성 → 우선순위 낮음
- 후속 wave에서 measure 후 분리 결정

### 5d. fallback sample 부족
- mint/low_batt 같은 일부 class는 sample 부족 (low_batt 317건)
- `MIN_SAMPLE_COUNT_FOR_CONFIDENCE = 3` 이상에서만 해당 class 시세 사용, 미만이면 fallback chain
- order: target → 가까운 class → normal → all → 어떤 row든

### 5e. accessory_bundle/multi_device_bundle 차단 유지
- 이 둘은 condition이 아닌 "본품 + 다른 것" 묶음 → 단품 시세에 끼면 부정확
- Wave 90 정책 유지 (시세 산정 차단)
- 풀 진입은 별개 (싸게 올라온 번들도 차익 매물)

## 6. retention 효과 (가설)
- 같은 매물 condition에 맞는 시세 표시 → "내 매물 사용감인데 시세 mint 기준 → 차익 부풀려져"라는 사용자 짜증 해소
- otherConditions 비교 chip → "내 매물 worn 시세 vs mint 시세 차이" 가시화 → "끼리 비교" 학습
- profit 계산 정확도 ↑ → pool 진입 매물 더 정확 (mint 시세 기준 차익 부풀어 풀 진입했다가 실제 매물은 worn인 경우 → 더 이상 발생 X)

## 7. 다음
- 24h 후 market-worker tick 측정 — condition별 row 분포 확인 (mint/clean/normal/worn/low_batt 각각 sample 충분한지)
- 1주일 후 사용자 reveal feedback 측정 — "시세 정확" 비율 변화
- velocity_daily condition 분리 (회전 시간 차이 측정 후 결정)
- RPC `reserve_mvp_pool_candidates` 시그니처 변경 (별도 fetch 1 round trip 제거)

## 8. 거론 금지
- velocity_daily condition 분리 — 측정 먼저
- decay weighted median wire-up (Wave 129 함수만 작성) — 별도 wave
- AI L2 needs_review escrow — FK migration 별도 wave
- 신모델 launch event reset — event table 별도 wave
