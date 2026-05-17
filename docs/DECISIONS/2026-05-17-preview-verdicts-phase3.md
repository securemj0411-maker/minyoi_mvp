# 2026-05-17 preview-masked Phase 3 — buildVerdicts 통합

## 사용자 지적

> "근데 지금 잘 한거 맞아?? 나 메인사이트 봤는데 신규, 무료배송 시세 신뢰 보통 이런거 밖에 안보이는데??"

Phase 2 는 사용자 reveal 모달 / 운영자풀 / 나의 상품 만 통합. **메인 페이지 (preview-masked) 는 hardcode 3 chip 유지** (보안 우려). 사용자 메인 페이지에서도 새 chip 원함.

## 박은 변경 (commit `1359b2c`)

### API (/api/preview-pool)
- pool select 에 `comparable_key` 추가
- selected 5 매물 의 comparable_key 로 추가 fetch:
  - `mvp_market_price_daily.sold_sample_count` (수요)
  - `mvp_market_velocity.median_hours_to_sold` (회전)
- 응답 field: `soldSampleCount`, `medianHoursToSold`

### frontend (preview-masked-dashboard)
- `buildVerdicts` import + 호출
- hardcode chip 줄 → buildVerdicts 줄
- input (비로그인 안전 데이터만):
  - price, skuMedian, profit, confidence
  - soldSampleCount, medianHoursToSold
  - freeShipping, lastSeen
- **셀러 정보 / desc 등 raw 노출 X** (보안 유지)

### 표시 가능 chip
- 시세보다 -N% (가격 매력)
- 🔥 수요 매우높음 / 수요 높음 / 수요 보통 (sold count 등급)
- 평균 N일 회전
- 시세 신뢰 높음/보통/낮음
- 🆕 방금 등록
- 무료배송

## 통일

`buildVerdicts` 단일 source — 4 화면:
- pack-reveal-modal (사용자 reveal)
- admin-pool-browser (운영자풀)
- user-reveal-dashboard (나의 상품)
- preview-masked-dashboard (메인 페이지 비로그인)

threshold 변경 → `src/lib/listing-verdicts.ts` 1곳만 → 4 화면 자동 sync.

## 보안 유지

- 셀러 review / rating / desc / pid / 매물명 raw 노출 X
- buildVerdicts 에 안전한 input 만 전달
- 마스킹된 매물명 + blur 처리된 이미지 정책 그대로

## Test

288/288 pass.
