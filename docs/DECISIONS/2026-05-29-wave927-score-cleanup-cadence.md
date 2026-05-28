# Wave 927 — Score Worker Cleanup Cadence

## Context

Wave 926 이후 추가 비용 점검. 최근 60분 기준 `score-worker` A는 p50 약 37s, p95 약 47s이고 매분 실행 중이다. B worker는 cleanup 없이 p50 약 21s로 동작했다.

## Finding

- A worker의 실제 scoring은 계속 필요하지만, residue cleanup은 매분 돌 필요가 적다.
- 최근 샘플에서 `score_cleanup_clear_non_scorable`가 약 8s를 쓰면서 실제 cleared row는 0건인 케이스가 있었다.
- cleanup 전체는 ready 안정성에 필요하므로 제거하지 않고 cadence를 낮추는 쪽이 안전하다.

## Decision

- `score-worker` A의 cleanup을 기본 5분 간격으로 변경.
- 매분 scoring은 그대로 유지한다.
- 운영 복구/수동 확인용으로 `?cleanup=1`, `?cleanup=0` query override를 지원한다.
- env `PIPELINE_SCORE_CLEANUP_INTERVAL_MINUTES`로 간격을 조정할 수 있게 했다. `1`이면 기존처럼 매 run cleanup.

## Expected Effect

- cleanup이 skipped되는 4/5 run에서 A worker 실행시간이 약 8~13s 줄어들 것으로 기대.
- ready 반영 지연은 늘리지 않는다. 단, stale/residue 정리는 최대 몇 분 늦어질 수 있음.

## Deferred

- `score_build_effective_sku_map` 최적화: fashion `ruleMatch` 재평가가 여전히 5~8s를 쓴다. catalog/parser 안전성과 엮여 있어 별도 wave에서 캐시/fast-path 검토.
- `daangn-detail-worker` throttle: 현재 missing manner temperature backlog가 약 24k라 지금은 줄이지 않는다. backlog가 낮아진 뒤 자동 throttle 검토.
