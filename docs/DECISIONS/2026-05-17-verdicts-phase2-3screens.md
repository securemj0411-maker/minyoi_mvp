# 2026-05-17 verdicts Phase 2 — admin-pool + user-reveal-dashboard

## 진행 사항

Phase 1 (commit `8ec12e6`): pack-reveal-modal 에 buildVerdicts 통합.
Phase 2 (이 PR): admin-pool-browser + user-reveal-dashboard 확장.

## 박은 변경

### admin-pool-browser
- `buildVerdicts` import + 호출
- PoolItem 가진 raw 데이터만 활용:
  - price, skuMedian, expectedProfit, confidence, lastSeenAt
- 표시 가능 chip:
  - **시세보다 -N%** (price + skuMedian)
  - **시세 신뢰 높음/낮음** (confidence)
  - **🆕 방금 등록** (lastSeenAt 1h 이내)
- 셀러 리뷰 / velocity / freeShipping 등 데이터 X → 해당 chip 없음
- 추가 fetch 작업 보류 (admin 화면 — chip 일부만 OK)

### user-reveal-dashboard
- `buildVerdicts` import + 호출
- RevealItem 거의 full data — 모든 chip 가능:
  - 사용감 주의 / 상태 좋음 (descriptionPreview)
  - 평균 N일 회전 (velocityBasis)
  - 매물 활발 (skuListingFlow)
  - 시세 신뢰 (marketBasis)
  - ★N.N 셀러 (sellerReview)
  - 무료배송, ❤️ N (favoriteCount)

### preview-masked (메인 페이지)
- 보류 — 현재 hardcode chip 4종 유지
- 사유: 비로그인 사용자에게 raw 데이터 (셀러 정보 / velocity / desc) 노출 risk

## 통일

- pack-reveal-modal / admin-pool-browser / user-reveal-dashboard 3 화면 chip = `buildVerdicts` 단일 source
- threshold 변경 시 `src/lib/listing-verdicts.ts` 1곳만 update → 3 화면 자동 sync (drift 차단)

## 다음 (Phase 3, 보류)

- chip 별 popover 상세 근거 (hover/클릭 시 "comparable 18건 / IQR 12%" 같은 detail)
- chip 자체에 SVG icon 추가 (lucide-style — 🔥 → FlameIcon)
- admin-pool 에 셀러 리뷰 / velocity fetch 추가 (chip 더 풍부)

## Test

288/288 pass.

## Commit

`ef6d342` verdicts Phase 2 (admin-pool + user-reveal-dashboard)
