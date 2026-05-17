# 2026-05-17 preview-masked: 시세 + 수익률 % 추가

## 사용자 지적

> "그리고 매입이랑 시세랑 몇퍼센트 수익인지 우리 대시보드 처럼 좀 적당히 해야지"

이전: 매입 ₩140,000 · +180,000원 (시세/수익률 없음)
새: 매입 ₩140,000 · 시세 ₩320,000 / +180,000원 +128%

## 박은 변경 (commit `55f8f06`)

### API
- `/api/preview-pool`: `sku_median` 추가 (mvp_listings.sku_median)
- 응답 `skuMedian: number | null`

### UI
- 카드 layout:
  - 1행 (메타): "매입 ₩X · 시세 ₩Y" — semi-bold, 회색 톤
  - 2행 (차익): "+N원" emerald chip + "+P%" amber chip
- `profitPctLabel` 함수: `Math.round((avg / price) * 100)`
- `skuMedian` null/0 일 때 "시세" 부분 표시 X (안전)

admin-pool-browser 와 동일 패턴 (매입 · 시세 · 차익 · 수익률).

## Test

288/288 pass.
