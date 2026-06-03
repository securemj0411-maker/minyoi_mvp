# Wave 1050 — Feed-ready velocity gate

## 결정

유료 추천 피드의 `ready` 승격은 이제 `mvp_market_velocity_daily`에 실제 회전률 신호가 있는 comparable key만 허용한다.

카탈로그/SKU의 `ready`는 그대로 “분류와 시세 계산 가능” 상태로 두고, 사용자 피드 노출 가능 상태만 별도로 “회전률까지 관측됨”으로 본다.

## 구현

- `candidate-pool-builder`에 `liquidVelocityComparableKeys` 입력을 추가했다.
- score worker는 이번 배치의 comparable key를 모아 `mvp_market_velocity_daily`를 한 번에 조회한다.
- 기준은 비회원 미리보기와 맞췄다.
  - `median_hours_to_sold > 0`
  - `sold_7d_count >= 1`
  - `observed_sold_sample_count >= 3`
- 조회 성공 시 세트에 없는 row는 `invalidated_reason = velocity_missing`으로 보류한다.
- velocity 조회 자체가 실패한 tick에서는 대량 오차 invalidation을 막기 위해 gate를 건너뛰고 로그에 `score_pool_gate_velocity_gate_skipped=1`을 남긴다.
- 기존 ready 잔여물도 score cleanup에서 점진적으로 `velocity_missing`으로 내린다.
- recovery worker는 `velocity_missing`을 회복 가능 사유로 보고, velocity가 생기면 raw row를 `score_dirty=true`로 마킹해 다음 score tick에서 자동 재평가한다.

## 보류

- `ready` 카탈로그 자체를 velocity 기준으로 내리는 것은 보류했다. 그러면 신규 SKU/카테고리 수집과 분석까지 같이 막혀 운영 유연성이 떨어진다.
- high/medium confidence만 허용하는 더 강한 liquidity gate는 보류했다. 지금은 “회전률 데이터 없음”을 막는 게 1차 목표라 3 sold sample 기준으로 시작한다.

## 검증

- `npx tsx --test --test-name-pattern "candidate pool builder (blocks otherwise-ready rows without feed velocity|allows feed-ready rows with observed velocity)" tests/core-rules.test.ts`
- `npx tsc --noEmit --pretty false 2>&1 | rg "candidate-pool-builder|tick-pipeline|core-rules|velocity_missing|liquidVelocity"`: 관련 타입 오류 없음
- `npx eslint src/lib/candidate-pool-builder.ts src/lib/tick-pipeline.ts tests/core-rules.test.ts`: 기존 `tick-pipeline.ts` unused warning 7개만 남음

## 참고

전체 `tests/core-rules.test.ts`는 기존 AirPods 4 no-ANC lane 테스트 1개가 실패한다. 이번 velocity gate 테스트 2개는 통과했고, 실패 지점은 카탈로그/룰매치 쪽으로 이번 변경 범위 밖이다.
