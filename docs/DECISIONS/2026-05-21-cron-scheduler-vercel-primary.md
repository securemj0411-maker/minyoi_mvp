# 2026-05-21 Cron Scheduler: Vercel Primary, QStash for Queue/Retry

## 결정

- 기본 반복 스케줄러는 Vercel Cron을 primary로 둔다.
- QStash는 완전히 버리지 않고, retry/DLQ/queue/flow-control이 필요한 fan-out 작업에만 보조로 쓴다.
- 중고나라 source 편입 후에도 top-level schedule은 Vercel Cron에서 시작하고, source별 세부 처리량은 DB lock/lease와 내부 batch size로 제어한다.

## 근거

- Vercel Pro Cron은 프로젝트당 100개까지 가능하고 최소 간격이 1분이며 per-minute precision이다.
- Cron Jobs 자체는 Vercel 플랜에 포함되어 있고, 실행은 Vercel Function 사용량/가격 정책을 따른다.
- 현재 repo는 이미 `checkCronAuth`, `acquireCronGuard`, Supabase `mvp_cron_locks` 기반의 중복 실행 방지 구조를 갖고 있다.
- 현재 `vercel.json`에는 daily성 4개만 등록되어 있고, 핵심 runtime worker(`tick`, `detail-worker`, `lifecycle-worker`, `market-worker`, `pool-warmer`, `deep-crawl`, `housekeeper`)는 별도 scheduler 의존이 남아 있다.
- QStash도 1분 cron schedule 자체는 가능하다. 차이는 schedule 간격이 아니라 retry/DLQ/queue/flow-control 제공 여부다.
- 현재 핵심 cron routes는 대부분 `maxDuration=90`, cron auth, guard를 갖고 있다. QStash가 호출하든 Vercel Cron이 호출하든 실제 작업 실행은 Vercel Function에서 발생하므로 compute 병목은 scheduler가 아니라 route 내부 batch/concurrency다.

## QStash를 남기는 경우

- 실패 시 자동 retry/DLQ가 필요한 작업.
- source API 부하를 queue parallelism/rate로 천천히 흘려보내야 하는 작업.
- Vercel Cron 한 번이 많은 URL/카테고리/상품 세부 작업으로 fan-out되어야 하는 경우.
- 배포 없이 schedule id를 콘솔/API로 빠르게 조정해야 하는 임시 운영 작업.

## 주의

- Vercel Cron은 실패한 invocation을 자동 retry하지 않는다. 중요 worker는 route 내부에서 idempotent 재시도/다음 tick 회복이 되게 유지한다.
- Vercel Cron은 같은 schedule이 겹쳐 실행될 수 있고, 같은 event가 드물게 중복 전달될 수 있다. 기존 DB lock/idempotency를 모든 worker에 유지한다.
- Vercel Cron timezone은 UTC 기준이다. KST 운영 시간은 cron expression에서 UTC로 환산해 적는다.

## 다음 작업

1. `vercel.json`에 핵심 worker schedule을 단계적으로 편입한다. 2026-05-21 1차 적용:
   - `/api/cron/tick` — `* * * * *`
   - `/api/cron/detail-worker` — `* * * * *`
   - `/api/cron/lifecycle-worker` — `*/5 * * * *`
   - `/api/cron/pool-warmer` — `2,7,12,17,22,27,32,37,42,47,52,57 * * * *`
   - `/api/cron/housekeeper` — `7,37 * * * *`
   - `/api/cron/market-worker` — `12 * * * *`
   - `/api/cron/deep-crawl` — `27 * * * *`
   - `/api/cron/reference-price-refresh` — `10 19 * * *`
   - `/api/cron/compliance-retention` — `20 19 * * *`
2. QStash에 남아 있는 schedule id 목록을 정리하고, Vercel로 옮긴 항목은 중복 호출을 끈다.
3. 각 route의 `checkCronAuth`/guard/collect-log/timeout이 빠진 곳을 점검한다.
4. 중고나라 worker는 처음부터 low-frequency Vercel Cron + internal source throttle로 시작한다.

## 적용 메모

- `collect` route는 `tick`이 search stage를 흡수하므로 별도 Vercel Cron에 등록하지 않았다.
- `hotdeal-worker` route는 `pool-warmer`에 흡수된 구조라 중복 발송을 피하려고 등록하지 않았다.
- `landing-showcases`와 `housekeeper-ai-cache-prune`은 베타 단계 보류 결정을 유지했다. 사용자 수/DB 사이즈 증가 시 별도 등록한다.
- 로컬에 `QSTASH_TOKEN`이 없어 현재 Upstash schedule 목록은 확인하지 못했다. Vercel 배포 후 QStash 콘솔에서 동일 endpoint schedule을 꺼야 중복 호출을 피할 수 있다.

## 2026-05-21 운영 로그 재확인

- `mvp_collect_runs` 최신 1000개 기준, Vercel Cron 배포 직후 `vercel-cron/1.0` 호출이 들어오기 시작했고 QStash 호출도 동시에 남아 있었다.
- QStash 실측 주기:
  - `detail-worker`: 약 3분.
  - `tick`: 약 5분.
  - `lifecycle-worker`: 약 5~7분.
  - `housekeeper`: 약 30분.
  - `pool-warmer`: 약 30분이나 일부 90~150분 gap.
  - `deep-crawl`: 약 30분이나 일부 90~150분 gap.
  - `market-worker`: 약 60분.
- 최근 로그에서 `tick`은 p50 duration 약 81s, p95 약 89s였고, stale auto-mark 실패가 반복됐다. Vercel 1분 schedule에서는 overlap 방지가 필수다.
- 발견: `tick`, `detail-worker`, `lifecycle-worker` 기본 모드, `housekeeper`가 기존에는 in-memory guard만 사용했다. Serverless 인스턴스가 갈라지면 QStash/Vercel 중복 호출을 막지 못할 수 있다.
- 조치: 위 4개 route도 `acquireCronGuardWithSourceHealth()`를 사용하도록 바꿔 `CRON_GUARD_DB_LOCK_ENABLED=1` 환경에서 Supabase DB lock을 타게 했다.
- 권고: QStash의 같은 endpoint schedule은 즉시 끈다. 끄지 않으면 Vercel Cron과 QStash가 동시에 production worker를 때린다.

## 2026-05-21 QStash 비활성화 후 확인

- 사용자 조치로 QStash schedules를 끈 뒤 `mvp_collect_runs`를 재확인했다.
- 최근 12분 구간에는 QStash 잔상 13건과 Vercel 18건이 섞여 있었고, 마지막 QStash 기록은 `2026-05-20T23:42:51Z`의 `/api/cron/lifecycle-worker?wait=1`였다.
- 이후 최근 4분 구간(`2026-05-20T23:43:09Z` 이후)은 Vercel 8건, QStash 0건이었다.
- 해당 구간에서 확인된 Vercel Cron 경로:
  - `/api/cron/tick`
  - `/api/cron/detail-worker`
  - `/api/cron/lifecycle-worker`
  - `/api/cron/pool-warmer`
- 결론: DB 실행 로그 기준으로 QStash 중복 호출은 끊기고 Vercel Cron 호출은 정상 유입 중이다. 단, 로컬 Vercel CLI token이 유효하지 않아 Vercel 플랫폼 로그 직접 조회는 하지 못했다.

## 2026-05-21 중고나라 Active Cron 추가

- `/api/cron/joongna-worker`를 Vercel Cron에 추가했다.
- schedule: `3,18,33,48 * * * *` (15분 간격, UTC)
- `JOONGNA_SOURCE_MODE=off`면 route는 collect log에 skipped만 남기고 DB write를 하지 않는다.
- `JOONGNA_SOURCE_MODE=active`일 때는 `pool_eligible=true`, `score_dirty=true`로 저장해 기존 score/pool pipeline이 중고나라 매물을 평가하게 한다.
- 운영 전제: Vercel production env에서 `JOONGNA_SOURCE_MODE=active`를 켜야 실제 중고나라 ingest가 시작된다.

## 2026-05-21 Score Worker 분리

- redeploy/env 적용 후 `/api/cron/joongna-worker`는 Vercel Cron으로 정상 실행됐다.
  - `trigger_source='vercel-cron/1.0'`
  - `mode='active'`
  - `rawUpserted=12`
  - `sourceHealthReason='active_ingest_ok'`
- 확인 중 `tick`의 search stage가 55~58초를 소모하고 score stage가 `timedOut=true`, `scored=0`으로 끝나는 병목을 확인했다.
- 중고나라 row는 `pool_eligible=true`, `score_dirty=true`로 들어왔지만 score dirty backlog가 1.5만 건 이상이라 pool/listing 산출이 지연될 수 있었다.
- 조치:
  - `/api/cron/score-worker`를 추가해 score stage만 독립 실행한다.
  - Vercel Cron schedule은 `* * * * *`로 둔다.
  - DB guard mode는 `score_worker`, cooldown 60초, lease 90초.
  - 기본 score budget은 `PIPELINE_SCORE_WORKER_BUDGET_MS=70000`으로 둬 Vercel 90초 한도 안에서 dirty backlog를 별도로 drain한다.
  - `loadScorableRows()`에 `source='joongna'` reserve를 먼저 태우는 fetch를 추가했다. 번개장터 search touch가 매분 수천 건 발생해도 중고나라 active row가 score backlog 뒤로 계속 밀리지 않게 한다.
- 보류:
  - `tick` 안 search/score 순서 재배치 또는 source-aware fair score ordering은 별도 작업으로 둔다.
  - score-worker 안정화 후 `tick`은 search-only에 가깝게 축소할지 검토한다.
