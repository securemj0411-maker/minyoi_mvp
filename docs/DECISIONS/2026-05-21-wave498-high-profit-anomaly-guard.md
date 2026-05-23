# Wave 498 — High-Profit Anomaly Guard

## 결정

사용자 피드에 노출되는 candidate pool 진입 단계에서 `순수익률이 과하게 높은 매물`을 보류한다.

너무 높은 수익률은 실제 대박 매물일 수도 있지만, 중고 시세 시스템에서는 다음 원인이 더 위험하다.

- 모델/세대/상태 sample 오분류
- 본품이 아닌 구성품/단품/액세서리 혼입
- broad SKU에 한정판/다른 라인이 섞임
- 사진/후기/상태 정보가 약한 매물의 가품·하자 리스크

## 적용 정책

- 전자기기류: net ROI 40% 이상이면 user-facing pool 보류
- 패션/가방/신발 등 변동성 큰 카테고리: net ROI 70% 이상이면 보류
- 약한 신호가 있으면 카테고리 무관 net ROI 45% 이상부터 보류
  - broad SKU
  - 상태 unknown
  - 사진 2장 이하
  - 판매자 후기 5개 미만 또는 미수집
  - parse confidence < high 기준

보류는 삭제가 아니라 `mvp_candidate_pool` invalidation reason 으로 남긴다.

## 구현

- `src/lib/candidate-pool-builder.ts`
  - `highProfitAnomalyReason` 추가
  - 기존 pool policy, risk gate, category readiness 통과 후 마지막 사용자 노출 직전에 검사
  - reason 예:
    - `profit_roi_above_40pct_electronics_review`
    - `profit_roi_above_45pct_weak_signal_review`
    - `profit_roi_above_70pct_bag_review`
- `tests/wave498-high-profit-anomaly-guard.test.ts`
  - 전자기기 40% 이상 보류
  - 전자기기 40% 미만 통과
  - 가방/패션 70% 미만 강한 신호 통과
  - 가방/패션 70% 이상 보류
  - 약한 신호 45% 이상 보류

## 보류

- 기존 ready pool row 즉시 일괄 invalidate는 이번 작업에서 하지 않았다.
  - 다음 score/pool rebuild 시 자연 반영된다.
  - 즉시 반영이 필요하면 별도 admin/backfill 스크립트로 현재 ready pool을 재평가해야 한다.
- 카테고리별 threshold는 운영 데이터로 조정 가능하다.
  - 특히 의류/가방은 진짜 고수익 매물이 있을 수 있어 너무 낮게 잡지 않았다.
