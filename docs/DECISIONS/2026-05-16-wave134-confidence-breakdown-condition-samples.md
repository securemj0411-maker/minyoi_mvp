# Wave 134 — ConfidenceBreakdown condition별 표본 분리 (사업 보고서 L2 retention 강화)

> Wave 130 marketBasis.otherConditions 데이터 활용 — pack-reveal-modal 신뢰도 패널에 condition별 표본 분리 표시.

## 1. 시간 + 동기
- 2026-05-16 진행 (Wave 133 commit 866b248 후속)
- 사용자 명령 "다음 ㄱㄱ" → B 옵션 (ConfidenceBreakdown 분리) 진행

## 2. 변경
### `src/components/pack-reveal-modal.tsx` `ConfidenceBreakdown`
- 시세 표본 line value: `"X건 (판매 Y건)"` → `"내 등급(사용감) X건 (판매 Y)"` (matchedConditionLabel 명시)
- 신규 row "**다른 등급 표본**" 추가:
  - marketBasis.otherConditions 활용 (Wave 130에서 이미 채움)
  - 형식: `"새상품/미개봉 30건 · S급/풀세트 28건 · 사용감 25건"`
  - sample ≥ 3 만 표시 (fetchLatestMarketStats 정책 — sample 부족 시 fallback에 포함 안 됨)

## 3. 검증
- 165/165 test pass
- tsc clean

## 4. retention 효과
- 사용자: "내 매물 condition 표본 N건 + 다른 등급 표본 비교" = 신뢰 시그널 강화
- 옛: "시세 표본 30건" — 어떤 condition인지 모호
- 신: "내 등급(사용감) 25건 + 다른 등급 별도 표본" — "끼리 비교" 가시화

## 5. 다음
- L5b launch event reset (사업 보고서 마지막 항목)
- 또는 24h 자연 누적 + 다른 영역
