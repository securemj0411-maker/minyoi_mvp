# Wave 131 — Exponential decay 시세 산정 wire-up (사업 보고서 L5 temporal)

> 사업 보고서 L5: "30일 데이터 단순 평균 X. 최근 7일 weight 3x." Wave 129에서 decay 함수만 작성하고 미적용. 이번 wave에서 mvp_market_price_daily 산정 로직에 wire-up.

## 1. 시간 + 동기
- 2026-05-16 진행 (Wave 130 commit 15dbbdf 후속)
- 사용자 명령: "L5 decay wire-up 바로 시작" + "시뮬해도 어차피 우리 작업하면서 다 까먹잖아 ㅋㅋㅋㅋ" (backtest skip, 24h 자연 누적 신뢰)

## 2. 발견
- Wave 129 (2026-05-16 fc9e929)에서 `exponentialDecayWeight` + `weightedMedian` + `decayWeightedMedian` 함수만 작성하고 wire-up 안 됨
- 시세 산정 (`upsertMarketPriceDaily`)에서 여전히 `trimmedSellerMarket` (단순 median) 사용
- 옛 매물 (30일+ 안 팔리는 매물) = 호가 inflated → 시세 끌어올림 (사용자 코멘트 다수)

## 3. 변경
### 3a. `src/lib/market-math.ts`
- `decayTrimmedSellerMarket(rows: SellerPricedRow[])` 함수 신규
  - `sellerRepresentativesWithAge()`: seller별 가장 최근 매물(가장 작은 ageDays) 선택 — 옛 호가 자동 dedupe
  - `madTrim` 그대로 (outlier 제거 보호)
  - 최종 median 대신 `weightedMedian` — weight = `exponentialDecayWeight(ageDays)` = `3 * exp(-ageDays/10)`
  - p25/p75도 `weightedQuantile` (weight 누적 25%/75%)
- `weightedQuantile()` 내부 함수 추가
- `sellerRepresentativesWithAge()` 내부 함수 추가

### 3b. `src/lib/tick-pipeline.ts`
- import: `decayTrimmedSellerMarket` 추가
- `upsertMarketPriceDaily` 안의 시세 산정 3 호출 (active/sold/disappeared) `trimmedSellerMarket` → `decayTrimmedSellerMarket` 교체
- `toSellerPriced()` mapper 추가: `ScorableRawRow` → `SellerPricedRow` + `observedAt = source_updated_at ?? last_seen_at`
- `trimmedSellerMarket` import 유지 (다른 곳 영향 X, removeable but safe)

### 3c. `tests/wave131-decay-market-price.test.ts` (신규, 7 케이스)
1. `exponentialDecayWeight`: 7일 ~1.5x / 30일 ~0.15x 검증
2. `weightedMedian`: 옛 매물 weight 낮으면 시세 무시
3. `decayTrimmedSellerMarket`: observedAt 없으면 fallback (옛 동작 호환)
4. 옛 호가 inflated 무시 (사업 가치) — 45일된 200K가 최근 시세 끌어올리면 안 됨
5. seller당 가장 최근 매물 자동 선택 — 옛 매물 자동 dedupe
6. decay vs 옛 동작 비교 — decay median < old median (옛 호가 weight 낮춤 효과 측정)
7. 빈 rows → null

## 4. 검증
- 159/159 test pass (152 기존 Wave 130 + 7 신규) ✓
- tsc clean (`.next/dev/types/validator.ts` 빌드 artifact 에러만)
- decay weight 수식 검증: weight = `3 * exp(-ageDays / 10)`
  - ageDays=0 → weight 3.0 (신선 매물)
  - ageDays=7 → weight 1.49 (~1.5x, 보고서 권장)
  - ageDays=10 → weight 1.10
  - ageDays=20 → weight 0.41
  - ageDays=30 → weight 0.15
  - ageDays=45 → weight 0.03 (거의 무시)

## 5. 위험
### 5a. observedAt source (source_updated_at)
- 셀러가 매물 가격 내릴 때마다 갱신될 수 있음 — 진짜 등록일(first_seen_at) 아님
- 결과: 자주 갱신하는 셀러 매물 = weight ↑ (의도와 맞음 — 갱신 = 활발한 셀러 = 실시간 가격)
- 옛 매물 (셀러도 신경 안 쓰는 호가) = source_updated_at 옛 → weight ↓
- null이면 last_seen_at fallback

### 5b. madTrim과 decay 중복 효과
- madTrim이 outlier 가격 제거 + decay가 옛 매물 weight ↓
- 옛 매물이 가격적으로 outlier여도 madTrim에 안 잘리면 decay weight로 effectively 제거
- 가격 outlier (madTrim) + 시간 outlier (decay) 둘 다 보호

### 5c. seller 1명 대표 매물
- 같은 seller가 옛 호가 + 신규 호가 동시 → 신규만 채택 (가장 작은 ageDays)
- 옛 동작: seller별 median 가격 → 신구 평균. 신규 동작: 신규만.
- 영향: seller 호가 하향 조정 시 빠르게 반영 (의도 OK)

### 5d. condition 분리(Wave 130) + decay 동시 적용
- 같은 condition_class 매물 내에서 decay 적용 → 두 효과 곱
- 예: Apple Watch SE2 44mm worn 30일 된 호가 → condition 분리 + weight ↓ = 시세 매우 정확
- sample 분포 (24h 후 측정 필요): condition별 sample이 decay 후에도 충분히 남는지

## 6. retention 효과 (가설)
- 옛 호가 inflated 매물 (Apple Watch 30일+ 안 팔린 200K, 실제 시세 130K) → 시세 끌어올림 ↓
- 사용자 reveal 시 시세 = "지금 실제 거래되는 가격" 신뢰도 ↑
- profit 계산 정확도 ↑ → 풀 진입 매물 더 정확

## 7. 다음
- 24h 후 condition별 sample 분포 + decay 적용 시세 vs 옛 시세 비교 (자연 누적)
- 사용자 reveal feedback "시세 정확" 비율 변화 추적
- L5 launch event reset (신모델 launch 시점 별도 시세 트래킹) — 별도 wave (event table 신규 필요)
- L7 user feedback loop — 사용자 보류 결정

## 8. 거론 금지
- decay 함수 옛 사용처 (없음) 변경 — `trimmedSellerMarket` 그대로 유지
- AI L2 needs_review escrow — FK migration 별도 wave
- 신모델 launch event reset — event table 신규 필요
