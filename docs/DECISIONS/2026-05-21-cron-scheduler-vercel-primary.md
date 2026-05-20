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
