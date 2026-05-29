# 2026-05-30 wave951 - collect_runs stale marker DB lease

## 배경

- `markStaleCollectRuns`는 오래 `running`으로 남은 `mvp_collect_runs` row를 실패 처리해 watchdog/운영 화면이 stuck 상태로 오해하지 않게 한다.
- 문제는 이 함수가 `tick`, `score_worker`, `score_worker_b/c`, `detail_worker`, `recovery_worker`, `daangn_worker A/B/C`, `daangn_detail_worker` 등 여러 cron route에서 호출된다는 점이다.
- 기존 throttle은 module-local 60초라 같은 warm instance에서는 줄어들지만, Vercel 멀티 인스턴스/멀티 프로젝트에서는 각 함수가 같은 `mvp_collect_runs` PATCH를 반복 시도할 수 있었다.

## 결정

- 실제 stale PATCH 전에 `mvp_cron_locks`의 기존 RPC `try_acquire_mvp_cron_lock`으로 `collect_runs_stale_marker` lease를 잡는다.
- lease를 못 잡으면 이번 cron에서는 stale PATCH를 생략한다.
- lease RPC가 실패하면 기존 동작을 보존하기 위해 fail-open으로 stale PATCH를 실행한다.
- 기본 lease는 60초이며 `COLLECT_RUN_STALE_MARK_LEASE_SECONDS`로 조절 가능하다.
- 기존 local cooldown도 유지하고 `COLLECT_RUN_STALE_MARK_LOCAL_COOLDOWN_MS`로 조절 가능하게 했다.

## 기대 효과

- stale cleanup 책임은 유지하면서, 큰 `mvp_collect_runs` PATCH가 여러 cron에서 동시에 반복되는 것을 1분 1회 수준으로 줄인다.
- 실제 worker 처리량, 외부 fetch 규모, score batch는 건드리지 않는다.

## 검증

- 새 단위 테스트로 아래 케이스를 고정했다.
  - lease가 이미 잡혀 있으면 PATCH를 치지 않는다.
  - lease를 잡으면 stale run PATCH를 수행한다.
  - lease RPC가 장애면 fail-open으로 기존 stale PATCH를 수행한다.

## 보류

- `markStaleCollectRuns` 호출 route 자체를 housekeeper/tick으로 줄이는 것은 보류한다. 책임 범위를 줄이면 stuck run 정리가 늦어질 수 있어 이번에는 DB lease로만 중복 비용을 줄였다.
