# 2026-06-02 Wave 1025 — condition-aware velocity basis

## Trigger

Wave 1024에서 회전률 UI를 정직화한 뒤, 다음 과제로 "판매주기 정확도 자체"를 올릴 수 있는지 점검했다.

## Findings

- `mvp_market_velocity_daily` schema는 이미 `(date, comparable_key, condition_class)` primary key다.
- `sync_market_velocity_daily_for_category(p_category)` RPC도 이미 두 종류의 row를 만든다.
  - `condition_class != 'all'`: 같은 condition_class 기준
  - `condition_class = 'all'`: 같은 모델 전체 기준
- 그런데 앱 조회 경로는 대부분 `condition_class=eq.all`만 읽고 있었다.
  - 상세/쉬운모드에서 "판매주기"가 실제 상태보다 넓은 모델 전체 기준으로 표시됐다.
- 운영 DB spot check:
  - condition별 row는 존재한다.
  - 이어폰/스마트워치 등은 상태별 표본이 꽤 있고, 의류/가방은 아직 all fallback이 더 안전한 경우가 많다.

## Decision / Changes

- schema/RPC 변경 없이 앱 조회만 condition-aware로 바꿨다.
- `fetchLatestMarketVelocity()`:
  - 기존: comparable key별 `condition_class=all` row만 조회.
  - 변경: 해당 comparable key의 all row와 condition row를 함께 조회.
  - cache value를 단일 row가 아니라 row 배열로 바꿔 condition row가 두 번째 요청부터 사라지는 문제를 차단.
- `velocityBasisForCandidate()`:
  - 매물의 `condition_class`를 선택 인자로 받는다.
  - condition row가 아래 조건을 만족할 때만 사용한다.
    - `observed_sold_sample_count >= 3`
    - `sold_7d_count > 0`
    - `median_hours_to_sold > 0`
  - 부족하면 기존 all row로 fallback한다.
- payload에 `conditionSpecific` / `conditionClass`를 추가했다.
  - 상세 쉬운모드는 "같은 상태 기준" 또는 "같은 모델 전체 기준"을 구분해 말할 수 있다.
- 적용 경로:
  - pack open
  - `/api/packs/reveals/detail`
  - `/api/packs/pool/analysis`
  - `/api/packs/me`
  - `/api/lookup/by-url`

## Deferred

- source-aware velocity는 아직 미구현.
  - 현재 `mvp_market_velocity_daily`에는 source 축이 없다.
  - 당근/번개/중고나라별 판매주기를 정확히 나누려면 새 PK/컬럼 또는 별도 materialized table 설계가 필요하다.
- condition_tier-aware velocity도 미구현.
  - 신발/의류의 S/A/B tier 회전률은 `condition_class`보다 더 정확한 축이지만, 현재 velocity table에는 `condition_tier`가 없다.

## Verification Plan

- `npm run build`
- 배포 후 대표 케이스에서 `velocityBasis.conditionSpecific`가 true/false로 갈리는지 API 응답 확인.
