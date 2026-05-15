# Wave 133 — 평균 차익 chip condition별 분리 (사업 보고서 L2 retention 강화)

> Wave 130에서 condition별 시세 분리 적용. 이번 wave에서 사용자 매물 매칭 화면 (recommendation-workspace)에 condition별 평균 차익 분리 chip 추가.

## 1. 시간 + 동기
- 2026-05-16 진행 (Wave 132b commit 9d4b6cf 후속)
- 다른 세션 제안: "평균 차익 chip을 condition_class별 분리 — 작은 작업. mint +9만원 / worn +6만원"
- ROI 명확: Wave 130 데이터 활용 + UI 1 컴포넌트 추가

## 2. 발견
- `recommendation-workspace.tsx`의 `💰 평균 차익 ~10만원` chip은 매칭 매물 pool 전체의 median expected_profit_min
- 같은 SKU+옵션이라도 condition별 시세 spread 15~40% (Wave 130 측정 — Apple Watch SE2 65%)
- 즉 평균 차익도 condition별로 큰 차이 — 단일 median은 misleading
- 사용자 통찰: "내가 사는 매물이 어느 등급인지" 답 받아야 retention

## 3. 변경
### 3a. `src/app/api/packs/preview-inventory/route.ts`
- PoolRow type에 `condition_class: string | null` 추가
- pool query SELECT에 `condition_class` 추가
- `profitByCondition`: `Record<string, { median: number; count: number }>` 신규 계산
  - condition별 grouping (matchingPool 기반)
  - flawed 제외 (풀 진입 안 됨)
  - sample < 3 제외 (정확성 우선 — sample 부족하면 median 의미 X)
- 응답에 `profitByCondition` 추가

### 3b. `src/components/recommendation-workspace.tsx`
- `PreviewInventoryResp` type에 `profitByCondition?` 추가
- 옛 `💰 평균 차익 ~10만원` chip 아래 condition별 chip 추가:
  ```
  새상품/미개봉 +12만 (43)
  S급/풀세트 +9만 (28)
  일반 +6만 (35)
  사용감 +4만 (34)
  배터리 저하 +2만 (3)
  ```
- 우선순위 순서: mint → clean → normal → worn → low_batt
- 1개 condition만 있으면 chip 숨김 (분리 의미 없음)

## 4. 검증
- 165/165 test pass (Wave 132 유지)
- tsc clean (`.next` 빌드 artifact 에러만)
- preview-inventory API응답에 `profitByCondition` 자동 포함

## 5. 위험
### 5a. sample < 3 condition 미표시
- mint/low_batt 같은 일부 class는 pool 전체에서 sample 작을 수 있음
- 정확성 우선 — 3 미만이면 표시 X (oversample 평균 misleading 방지)
- 대부분 condition은 3+ 있음 (Wave 132b backfill 분포: clean 130+, worn 100+)

### 5b. flawed 제외
- flawed는 풀 진입 안 됨 (Wave 130 정책) → profitByCondition에 들어갈 일 X
- 안전장치로 명시 (코드 readability)

### 5c. 1 condition만 있을 때
- chip 자동 숨김 (Object.keys(...).length > 1 체크)
- 옛 단일 평균 chip만 보임 (호환)

## 6. retention 효과 (가설)
- 사용자 추천 받기 전 화면에서 "내가 어느 등급 매물 받을지" 예상 가능
- "평균 차익 9만원" → "내 매물이 mint면 12만, worn이면 4만" → 기대치 보정
- 평균 한 줄 → condition별 ladder = 신뢰 시그널 강화

## 7. 다음
- 24h 후 사용자 reveal feedback 측정 (condition별 분리가 reveal 신뢰도에 미치는 영향)
- B) ConfidenceBreakdown condition sample 분리 (pack-reveal-modal 상세 신뢰도)
- L5b launch event reset (사업 보고서 마지막 항목)

## 8. 거론 금지
- profitByCondition을 byCategory 안에 nested 박음 — 별도 top-level (단순)
- condition 1 만 있을 때 표시 — 의미 X
