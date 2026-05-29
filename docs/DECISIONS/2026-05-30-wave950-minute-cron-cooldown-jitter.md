# 2026-05-30 wave950 - 1분 cron cooldown jitter 손실 축소

## 배경

- Vercel Cron은 1분 schedule이어도 실제 호출 시각이 몇 초씩 흔들릴 수 있다.
- `score_worker`, `score_worker_b`, `score_worker_c`, `recovery_worker`, `detail_worker`는 schedule이 `* * * * *`인데 guard cooldown도 60초였다.
- 이전 accepted run 시작 후 다음 cron이 57~59초 뒤 들어오면, 이전 run이 이미 끝났어도 cooldown으로 한 틱을 잃는다.
- 운영 집계에서도 최근 6시간 기준 cooldown skip이 skip 대부분을 차지했다.

## 결정

- 1분 cadence worker의 기본 cooldown을 60초에서 50초로 낮춘다.
  - `detail_worker`
  - `score_worker`
  - `score_worker_b`
  - `score_worker_c`
  - `recovery_worker`
- lease 값은 유지한다.
  - score worker 계열: 90초
  - detail worker: 120초
  - recovery worker: 60초
- 즉, 중복/장기 실행 방지는 lease/running guard가 계속 맡고, cooldown은 cron jitter 때문에 정상 tick을 잃지 않는 용도로만 둔다.

## 기대 효과

- 외부 fetch 규모, score batch, DB query limit은 그대로 두면서 “호출은 됐는데 1~2초 차이로 버리는” worker tick을 줄인다.
- 특히 score shard A/B/C는 최근 p50/p90이 1분 안쪽으로 들어온 상태라 ready 승격 체감 지연을 줄일 가능성이 높다.

## 보류

- `joongna_worker`는 3분 schedule에 5분 cooldown으로 의도적 감속일 수 있어 이번에 건드리지 않는다.
- 당근 ingest/detail cadence도 이미 별도 shard와 4분/5분 계열 guard로 튜닝되어 있어 이번 범위에서 제외한다.
- score worker DB lock 확대는 추가 RPC 비용이 생기므로, 실제 중복 실행 흔적이 보일 때 별도 wave로 검토한다.
