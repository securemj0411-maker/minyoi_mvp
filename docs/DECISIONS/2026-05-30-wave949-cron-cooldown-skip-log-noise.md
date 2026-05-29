# 2026-05-30 wave949 - cron cooldown skip 영구 로그 축소

## 배경

- 운영 cron 상태를 다시 보니 최근 6시간 `mvp_cron_executions` skip 682건 중 673건이 `skipped_cooldown`이었다.
- `cooldown` skip은 장애가 아니라 Vercel 1분 크론/멀티 배포 호출이 기존 guard cooldown 안에 다시 들어왔다는 정상 backpressure 신호다.
- 이 row들은 ready 처리량을 늘리지 않고 DB insert와 운영 화면 노이즈만 만든다.

## 결정

- `cooldown` skip은 기본적으로 `mvp_cron_executions`에 영구 저장하지 않는다.
- in-memory `skipCounters` / `recentSkips`는 그대로 유지해서 디버그 페이지의 즉시 관측은 유지한다.
- 필요 시 `CRON_GUARD_LOG_COOLDOWN_SKIPS=1`로 기존처럼 영구 저장을 다시 켤 수 있게 했다.
- `same_worker_running`, `source_health_unhealthy`, `project_role_disabled` 같은 실제 확인 가치가 큰 skip은 계속 저장한다.

## 같이 고친 점

- skip row를 저장할 때 `started_at`과 `finished_at`을 같은 app timestamp로 넣는다.
- 이전에는 DB default `started_at`과 app `finished_at` clock 차이로 skip row 시간이 어색하게 보일 수 있었다.

## 보류

- `markStaleCollectRuns` 호출 빈도 축소는 다음 후보로 남긴다. 여러 cron route가 동시에 stale cleanup을 시도할 수 있지만, cleanup 책임 범위를 바꾸는 작업이라 이번에는 로그 쓰기 절감만 적용했다.
- cron schedule 자체는 변경하지 않았다. 처리량/응답성 trade-off 없이 DB 로그 노이즈만 줄이는 범위로 제한했다.
