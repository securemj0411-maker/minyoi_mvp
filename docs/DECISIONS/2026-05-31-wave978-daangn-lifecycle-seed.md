# Wave 978 — daangn lifecycle seed 누락 fix

- 시간: 2026-05-31 13:50 KST
- 트리거: 사용자 코멘트 ("당근마켓은 lifecycle 안 돌아서 판매완료 처리가 안되고 있는거 같은데").

## 발견

- `mvp_lifecycle_checks` source 분포 측정:
  - bunjang: 160,967
  - joongna: 36,598
  - **daangn: 0** ← 누락
- `mvp_raw_listings` 측정: daangn active 363,989 / sold_confirmed 46,647 / disappeared 24,478. sold_confirmed 46k는 daangn-ingest 가 collect 시점에 `article.status` 보고 박은 stock — 이후 active로 들어온 매물이 daangn에서 sold 로 전환되어도 미뇨이는 추적 불가.
- sold_detected_at 추세 (최근 14일): bunjang 매일 300~2700건, joongna 30~110건, **daangn 5/27 이후 0~8건/일** (사실상 멈춤). 사용자 체감과 일치.
- `lifecycle-worker` cron 자체는 정상: 5분 주기, run 당 enriched 700~800, fail 0.

## 원인

1. `src/lib/tick-pipeline.ts:791-823` `seedLifecycleChecks` source 유니온이 `"bunjang" | "joongna"`만 정의 — daangn 미포함.
2. `src/lib/daangn-ingest.ts` 에서 `seedLifecycleChecks` 호출 자체가 없음. joongna-ingest 는 wave launch-41 에서 추가됐는데 daangn은 누락.
3. 다행히 `src/lib/tick-pipeline.ts:5862-5868` `fetchLifecycleDetailBySource` 는 daangn 분기 이미 구현 (`fetchDaangnLiveState`) — 시드 한 줄만 박으면 추적 가능.
4. `daangn-price-sweep-worker` 는 sold 비율을 read-only 로 집계만 함, lifecycle 전환 안 함.

## 변경 (Phase 0)

- `src/lib/tick-pipeline.ts` — `seedLifecycleChecks` source 유니온에 `"daangn"` 추가. 코멘트에 wave 978 sourcing 갱신.
- `src/lib/daangn-ingest.ts` — `upsertDaangnRawListings` 에서 active 매물만 lifecycle seed (joongna-ingest 패턴 그대로). `lifecycleTierForParsed` 로 tier 결정. best-effort try/catch — seed 실패해도 ingest 진행.
- backfill 미적용. 신규 collect 매물부터 자동 시드 시작.

## 검증

- `npx tsc --noEmit` clean
- `npm run test:core` 통과

## Ramp plan (앞으로)

기존 363k active backfill 은 Phase 0 12h 모니터 후 결정. Risk 확인 단계:

| Phase | 시드 규모 | 추가 lifecycle 부하 | stop 조건 |
|---|---:|---|---|
| 0 | 신규만 (자동) | 분당 ~수십건 | daangn detail fail >5% |
| 1 | backfill 1k | 시간당 ~6건 (general tier 7일 분산) | timeout >20% |
| 2 | backfill 10k | 시간당 ~60건 | 동일 |
| 3 | backfill 100k | 시간당 ~600건 (현재 9,600 대비 6%) | 동일 |
| 4 | 잔여 ~253k | 시간당 ~1,500건 (현재 대비 16%) | normal monitor |

## 위험

- daangn HTML fetch rate limit 신호 발생 시 즉시 phase 멈춤. fetchDaangnLiveState 가 blockSignal 표시.
- backfill phase 마다 priority_tier default `general` 로 박혀 7일 cycle 에 분산 → 일시 폭증 없음. parsed metadata 기반 promote 는 자연 cycle 따라.
- lifecycle worker 의 claim RPC 가 source 무관 — bunjang/joongna 처리량 일부를 daangn 이 차지. backfill 진행에 따라 bunjang 매물 sweep 주기가 미세하게 늘어남 (1시간 → 1.1시간 수준). 이는 source 별 priority weighting 추가로 보강 가능.

## 다음

- Phase 0 commit 후 12h 측정 query:
  - `SELECT status, last_check_result, COUNT(*) FROM mvp_lifecycle_checks WHERE source='daangn' GROUP BY 1,2`
  - `SELECT COUNT(*) FILTER (WHERE last_error IS NOT NULL) AS fail, COUNT(*) AS total FROM mvp_lifecycle_checks WHERE source='daangn' AND last_checked_at > NOW() - INTERVAL '1 hour'`
  - `SELECT stage_stats->'detail'->>'timedOut', COUNT(*) FROM mvp_collect_runs WHERE request_path LIKE '%lifecycle-worker%' AND started_at > NOW() - INTERVAL '6 hours' GROUP BY 1`
- 측정 결과 양호 시 phase 1 backfill SQL 실행.
- backfill 시 priority_tier 'general' default — joongna-ingest 처럼 향후 parsed 기반 promote 는 다음 ingest cycle 에 자연 발생.
