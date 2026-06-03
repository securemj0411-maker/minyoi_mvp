# Wave 1056 — Detail Velocity And Comparable Residue Fix

## Context

사용자가 상세보기/쉬운모드에서 `거래 기록 데이터를 받는 중이에요`, `비교 매물 누적 중`, `표본 부족`이 뜨는 문제를 보고했다. 이미 feed-ready 정책은 velocity가 있는 SKU만 노출하는 방향으로 바뀌었으므로, 상세 화면의 표시 기준과 DB ready pool 정합성을 함께 점검했다.

## Findings

- 쉬운모드 `velocityGuideStep`이 실제 로딩 상태가 아니어도 market/velocity 값이 비어 있으면 계속 `거래 기록 데이터를 받는 중`으로 판정할 수 있었다.
- `BeginnerGuideSpeedVisual`은 `analysisLoading`을 받지만 `saleSpeedDisplay`에 전달하지 않아 상세 카드와 쉬운모드 카드가 서로 다른 상태 문구를 낼 수 있었다.
- 비교매물 UI는 서버 API와 클라이언트에서 모두 상태/티어/출처/가격 범위를 강하게 필터링했다. velocity는 모델 전체 기준으로 통과했는데 화면용 비교 리스트만 0개가 되는 mismatch가 가능했다.
- 실제 DB 점검 결과 ready/reserved 7029개 중 2087개가 현재 feed velocity gate 기준(`observed_sold_sample_count >= 3`, `sold_7d_count >= 1`, `median_hours_to_sold > 0`)에 미달하는 과거 residue였다.
- residue cleanup은 `updated_at.asc` 최대 1000개만 훑어 최신 feed 노출 row를 놓칠 수 있었다.

## Decisions

- `거래 기록 데이터를 받는 중`은 실제 lazy analysis fetch 중일 때만 표시한다.
- velocity row에 거래 표본은 있지만 판매주기 median 표시가 불안정하면 `표본 부족`으로 뭉개지 않고 거래 기록 건수를 표시한다.
- 상세보기와 쉬운모드 비교매물은 공통 selector를 사용한다. strict 결과가 비면 가격 범위 완화, 이후 동일 모델 전체 기준으로 단계적으로 fallback하되 라벨을 명확히 바꾼다.
- `/api/listings/[pid]/market-source`는 strict 비교군이 비면 위험/명확한 하자/출처 guard는 유지하면서 상태·티어 필터를 완화한 동일 모델 proof row를 내려준다. 당근 매물은 cross-source proof를 계속 막는다.
- worker velocity residue cleanup은 최신 ready/reserved 최대 5000개를 스캔하도록 바꾼다.
- 현재 DB residue 2087개는 `velocity_missing`으로 invalidated 처리했다. 재검증 기준 ready/reserved 4942개 중 velocity gate 미달은 0개다.

## Deferred

- 비교매물 fallback scope를 API 응답 필드로 명시해 UI가 서버 fallback 단계까지 더 세밀하게 라벨링하는 작업은 보류했다. 현재는 클라이언트 selector 기준으로 표시 라벨을 조정한다.
- 전체 `tsc --noEmit`은 기존 테스트 fixture 타입 오류 때문에 실패한다. 이번 변경과 무관한 테스트 타입 정리는 별도 wave로 분리한다.
