# 2026-06-02 Wave 1009 — lifecycle/velocity 병목 점검과 source health gate 수정

## 배경
- lifecycle/velocity는 판매완료 가격, 회전주기, 회전률 산정의 핵심 입력이다.
- 2026-06-02 점검에서 Daangn raw intake와 lifecycle worker 자체는 살아 있었지만, lifecycle due backlog가 남아 있었다.
- 최근 샘플 기준 lifecycle worker A/B/C는 실패 없이 돌고 있었고, Daangn ready 감소는 일부 lifecycle 정리가 실제로 작동한 결과일 가능성이 있었다.
- 동시에 `mvp_source_health`는 source별 신호가 섞여 있었고, `tick-pipeline`의 lifecycle/pool-warmer 내부 gate는 `source=eq.bunjang` health만 읽고 있었다.

## 확인한 구조 리스크
- `lifecycleStage()`가 row source와 무관하게 번개장터 health를 전역으로 사용했다.
- health가 degraded이면 pool/near_pool 외 tier는 `skipped_source_degraded`로 밀린다.
- 이 때문에 당근/중고나라 lifecycle backlog가 실제 source 상태와 무관하게 번장 health 또는 stale health에 끌려갈 수 있었다.
- source health row가 오래되거나 없는 source를 바로 healthy로 보면 fetch 실패를 `disappeared`로 확정할 위험도 있다.

## 결정/구현
- lifecycle/pool-warmer가 source별 latest health를 한 번에 읽도록 변경했다.
- row source별 health가 fresh할 때만 throttle gate로 사용한다.
- source health가 없거나 6시간 이상 stale이면:
  - worker throughput은 막지 않는다.
  - 단, missing fetch를 terminal disappeared로 강하게 확정하지 않도록 `degraded`로 보수 처리한다.
- `state_reason`에 `source_health_${source}_${status}`를 남겨 이후 로그에서 어떤 source health가 영향을 줬는지 식별 가능하게 했다.
- lifecycle stage stats에 source별 health freshness flag를 추가했다.

## 보류
- 운영 DB에 인덱스를 즉시 적용하지 않았다. 후보:
  - `mvp_lifecycle_checks(source, next_check_at)` partial index
  - Daangn shard claim용 `(source, (pid % 3), priority expression, next_check_at)` partial index
  - `mvp_collect_runs(request_path, started_at desc)`
  - landing preview sold listing query용 sold/thumbnail/status partial index
- velocity는 아직 category 전체 재집계 방식이다. 장기적으로는 lifecycle observation 기반 incremental aggregate가 더 지속 가능하다.
- `sourceHealthStage()` 자체를 source별로 완전히 분리하는 작업은 다음 wave 후보로 남긴다.

## 검증
- `npm run build` 통과.
- `npx tsx --test tests/cron-guard.test.ts tests/lifecycle-state.test.ts tests/daangn-source-probe.test.ts` 통과: 24 pass.

## 운영 스냅샷
- 2026-06-02 16:15 KST REST 점검:
  - `mvp_source_health` 최신 샘플에는 `joongna=healthy`, `bunjang=degraded`가 있었고, fresh한 `daangn` row는 없었다.
  - Daangn due lifecycle sample query는 statement timeout(`57014`)이 났다.
  - 최근 배포본 lifecycle A/B/C는 성공 run으로 기록되지만 여러 run에서 `timedOut=true`, `enriched=0`이 반복됐다.
  - 특히 기존 배포본에는 source별 health freshness flag가 없으므로, 이번 patch 배포 후 stage stats에서 개선 여부를 다시 확인해야 한다.
  - velocity latest row는 2026-06-02 15:19 KST computed row가 존재해 완전 중단 상태는 아니었다.

## 운영 메모
- 이번 수정은 알람을 끄는 꼼수가 아니라, source mismatch로 인한 lifecycle throughput 손실을 줄이는 코드 경로 수정이다.
- 운영 DB schema는 변경하지 않았다.
- 빌드 중 랜딩 preview용 `mvp_raw_listings` sold query가 statement timeout을 냈지만 fallback으로 빌드는 성공했다. 이 쿼리는 별도 인덱스/캐시 개선 후보로 남긴다.
