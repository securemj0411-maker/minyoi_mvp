# Wave 1066 — Laptop velocity readiness gate

## Decision

- `맥북 프로 14인치 M1 Pro 16GB 512gb 실버` 상세/쉬운모드에서 판매속도가 `표본 부족`으로 나오는 원인을 확인했다.
- 해당 PID `9001496404236`은 DB에 velocity row가 실제로 존재했다.
  - comparable key: `macbook|macbook_pro|2021y|m1_pro|14in|16gb_ram|512gb_ssd`
  - `condition_class=all`: 최근 7일 판매 11건, median 약 171.9시간, confidence `medium`
  - `condition_class=worn`: 최근 7일 판매 3건, median 약 206.8시간, confidence `low`
- 원인은 DB 표본 부족이 아니라 `velocityBasisForCandidate()`의 category readiness gate였다.
  - pool 진입은 audited narrow lane으로 허용되어 있는데, velocity 표시는 broader category인 `laptop=internal_only` 때문에 null 처리됐다.
- velocity 표시는 이미 집계 row가 있는 경우 실제 통계를 보여주도록 하고, pool 노출 정책은 candidate selection 쪽에만 맡기기로 했다.

## Deferred

- `velocityBasisForCandidate()`의 `readinessMap` 인자는 기존 호출부 호환을 위해 남겼다. 후속 정리 때 signature를 단순화할 수 있다.
