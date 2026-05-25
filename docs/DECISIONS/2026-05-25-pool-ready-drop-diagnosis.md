# 2026-05-25 candidate_pool ready drop diagnosis

## Context

운영자 풀 화면에서 ready pool 이 아침 500개대에서 360개대로 줄어든 원인을 확인했다.

현재 KST 2026-05-25 01:28 기준:

- total: 6,078
- ready: 357
- invalidated: 5,700
- spent: 21
- ready band: band1 181, band2 70, band3 106

## Read-only Findings

최근 invalidated 이동이 매우 컸다.

- 2026-05-24 09:00 KST 이후 invalidated: 1,107
- 2026-05-24 18:00 KST 이후 invalidated: 846
- 2026-05-25 00:00 KST 이후 invalidated: 501
- 최근 30분 invalidated: 345

상위 원인:

- `negative_resell_gap`
- `profit_below_pack_band`
- `sku_median_unavailable`
- `stale_parser_version_clothing_residue`
- `stale_parser_version_shoe`
- `stale_parser_version_clothing`
- `stale_parser_version_shoe_residue`

카테고리별로는 clothing/shoe 가 가장 크게 빠졌다.

- 2026-05-24 09:00 KST 이후 clothing 314, shoe 268 invalidated
- 2026-05-25 00:00 KST 이후 clothing 176, shoe 101 invalidated

## Interpretation

번개장터 source outage 로 ready pool 이 직접 줄어든 정황은 약하다.

- 2026-05-24 00:12 KST Telegram 알림은 `degraded -> healthy` 회복 알림이었다.
- 해당 알림의 `Lifecycle terminal 9% 실패 (1/11)` 은 terminal recheck 1건 실패 수준이라 ready 100개 이상 감소를 설명하지 못한다.
- 이후 source health 는 일부 `deep_crawl_failure_rate_elevated` 로 degraded 가 있었지만 detail success 는 대체로 99.7~99.9%였다.

더 유력한 원인은 다른 세션의 parser/pool cleanup + recovery wave 다.

- Wave 801/804/806 에서 active ready/reserved pool purity cleanup 이 여러 차례 적용됐다.
- Wave 807 에서 fashion parser version drift sync 및 stale parser invalidated requeue 작업이 진행됐다.
- 이 작업들은 오염된 ready 를 먼저 invalidated 로 내리고, score/market 재처리로 다시 채우는 구조다.

현재 병목은 "청소는 빠르게 됐는데 refill/score 가 즉시 못 따라오는 상태"다.

- `mvp_raw_listings.score_dirty=true` 가 50,000건 이상 존재한다.
- 그중 scorable 조건을 만족하는 row 도 최소 42,720건이다.
- shoe/clothing dirty 는 최소 36,222건, scorable fashion dirty 는 33,028건이다.
- 최근 score-worker 는 `score_pool_stale_parser_residue_invalidated_rows` 와 dirty marking/cleanup 은 수행하지만, 여러 run 에서 `scored=0`, `poolUpserted=0`, `timedOut=true` 로 끝난다.

## Collision Risk

현재 worktree 에 parser/pool 관련 dirty 가 많다.

- `src/lib/tick-pipeline.ts`
- `src/app/api/debug/reparse-listings/route.ts`
- parser/catalog generated files
- `scripts/apply-fashion-parser-drift-requeue.ts`
- `scripts/run-score-stage-once.ts`
- `scripts/run-market-stats-stage-once.ts`
- `scripts/report-shoe-inflow-funnel.ts`

이 상태에서 별도 세션이 같은 파일을 수정하거나 전체 deploy 하면 충돌/부분배포 위험이 크다.

## Decision

지금 즉시 pool 정책을 느슨하게 하거나 전체 dirty worktree 를 배포하지 않는다.

우선순위는 다음과 같다.

1. parser/pool 세션의 scoped deploy 범위를 확인한다.
2. score-worker 가 cleanup 단계에서 시간을 다 쓰고 실제 scoring 으로 못 넘어가는 병목을 분리한다.
3. stale residue invalidation / dirty marking 은 별도 recovery-worker 또는 capped job 으로 빼는 방안을 검토한다.
4. market-worker failed/stale run 이 반복되는지 확인하고, `mvp_market_key_invalidation` pending 618개를 drain 한다.
5. 이후 ready pool 목표치를 다시 세운다. 최소 운영 하한은 450개 이상으로 모니터링한다.

## Deferred

- `profit_below_pack_band`, `negative_resell_gap`, `sku_median_unavailable` 을 임의로 완화하지 않는다.
- clothing/shoe precision gate 완화는 품질과 매출의 trade-off 이므로 별도 owner decision 으로 논의한다.

## Emergency Recheck 2026-05-25 03:58 KST

사용자가 운영 화면에서 ready pool 이 400대에서 82건 수준까지 줄었다고 긴급 중단 요청했다. 추가 read-only 재조회 결과, 같은 시각 candidate_pool 은 더 줄어든 상태였다.

- total: 6,134
- ready: 27
- invalidated: 6,086
- spent: 21
- ready band: band1 19, band2 1, band3 7
- ready category: speaker 8, bag 5, desktop 5, game_console 4, perfume 2, sport_golf 2, camera 1
- shoe/clothing/smartphone/tablet/earphone/laptop/smartwatch ready: 0

최근 invalidated 이동은 계속 컸다.

- 최근 1시간 invalidated: 154
- 최근 3시간 invalidated: 838
- 최근 6시간 invalidated: 1,053
- 최근 12시간 invalidated: 1,319

최근 3시간 상위 invalidated reason:

- `negative_resell_gap`: 102
- `sku_median_unavailable`: 85
- `stale_parser_version_earphone_residue`: 65
- `stale_parser_version_smartphone_residue`: 65
- `stale_parser_version_clothing_residue`: 62
- `profit_below_pack_band`: 59
- `stale_parser_version_tablet_residue`: 53
- `stale_parser_version_smartwatch_residue`: 41
- `stale_parser_version_clothing`: 36
- `stale_parser_version_earphone`: 32
- `stale_parser_version_shoe`: 23
- `stale_parser_version_tablet`: 18

번개 API 정지/차단이 직접 원인이라는 증거는 약하다.

- 최신 bunjang source_health: `healthy`, `within_operating_bounds`
- 최근 bunjang health rows: searchFailureRate 0, searchFailures 없음
- 최근 6시간 raw sample 1,000건 안에 `bunjang:done:active:normal:sku` 386건 존재
- scorable dirty row sample 은 여전히 1,000건 이상 존재

현재 판단:

- 직접 원인은 parser drift / all-category score cleanup 을 빠르게 돌리면서 기존 ready/reserved row 가 stale parser/economic gate 기준으로 먼저 invalidated 된 것.
- API 차단으로 새 매물이 끊긴 상황이 아니라, 정밀화 cleanup 속도가 refill/market/score 속도를 압도한 상태.
- 특히 all-category parser version sync 이후 `stale_parser_version_*` residue invalidation 범위가 전 카테고리로 확장되며 기존 ready pool 을 대량 청소했다.
- 추가 mutation 은 중단한다. 다음 조치는 owner 확인 전까지 read-only 진단과 recovery 계획 작성으로 제한한다.

## Emergency Recovery 2026-05-25 04:12 KST

원인 확정:

- 단순 API 차단이 아니었다.
- 로컬 수동 복구로 199건을 ready 로 올렸으나, 직후 운영 `score-worker` 가 `score_pool_stale_parser_post_residue_invalidated_rows=199` 로 다시 내렸다.
- 운영 배포본의 score-worker 가 최신 parser version target 을 아직 모르는 상태라, 현재 parsed row (`shoe v41`, `clothing v52`, `option-parser v61`)를 stale residue 로 오판했다.
- 즉 "개선 자체"가 아니라 "개선 적용/배포/ready 하한 보호 누락"이 문제다.

조치:

- `score_worker` DB lock 을 emergency owner `emergency_pool_ready_recovery_20260525` 로 잡아 2026-05-25 10:12 KST 까지 score-worker 를 임시 정지했다.
- `scripts/recover-ready-pool-current-safe.ts` 를 추가해 invalidated row 중 현재 parser/current raw/current pool policy 를 모두 통과하는 후보만 ready 로 복구했다.
- 2차 적용 결과:
  - applied: 184
  - current ready: 213
  - ready band: band1 126, band2 41, band3 46
  - ready category top: shoe 47, earphone 44, smartphone 23, tablet 20, clothing 16, drone 14, smartwatch 13
- 억지로 과거 400대로 롤백하지 않았다. 현재 기준을 통과하지 못한 row 는 여전히 invalidated 로 둔다.

코드 보강:

- `scoreStage` 에 pool ready floor circuit breaker 를 추가했다.
- 기본 `PIPELINE_POOL_CLEANUP_MIN_READY=350`; ready 가 이보다 낮으면 cleanup성 invalidation/stale residue invalidation/AI audit residue invalidation 을 defer 한다.
- score-worker 가 refill/upsert 는 할 수 있지만, ready/reserved pool 을 더 깎는 invalidation 은 ready floor 아래에서 보호한다.

검증:

- `npx tsx --test tests/fashion-parser-version-sync.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts` 통과 (63/63).
- `git diff --check` 통과.

남은 위험:

- score-worker lock 은 임시 지혈이다. lock 만료 전 운영 배포본에 parser target sync + ready floor guard 가 반영되어야 한다.
- 현재 repo 는 unrelated dirty file 이 많아 전체 worktree production deploy 는 위험하다. hotfix 범위를 분리해서 배포해야 한다.

## Clothing/Shoe Funnel Recheck 2026-05-25 04:18 KST

사용자가 "의류가 왜 16개인지", "유입 속도 자체가 문제인지", "분류 작업이 실제로 개선인지"를 재질문했다. read-only 로 shoe/clothing funnel 을 다시 생성했다.

현재 candidate_pool:

- total: 6,134
- ready: 213
- invalidated: 5,900
- spent: 21
- ready category: shoe 47, clothing 16, earphone 44, smartphone 23, tablet 20, drone 14, smartwatch 13, 기타 소량

raw 유입은 끊기지 않았다.

- shoe raw matched: 23,410 / eligible: 19,423 / seen24h: 9,164 / eligibleSeen24h: 8,361
- clothing raw matched: 18,131 / eligible: 15,639 / seen24h: 8,405 / eligibleSeen24h: 7,318
- 최신 tick 은 40개 query 에서 751건 collected, 77 raw full upsert 를 수행했다.
- 최신 bunjang/joongna cron 로그도 succeeded 상태다.

의류 ready 16의 직접 원인은 raw 유입 부족이 아니라 ready 승격/보존 경로 병목이다.

- clothing eligibleReady: 16
- clothing eligibleInvalidated: 545
- clothing eligibleNoPool: 15,078
- clothing parser current backlog: expected/emitted `wave216-clothing-v52`, 그러나 eligible parser mismatch 12,736건
- clothing top invalidation:
  - `profit_below_pack_band`: 258
  - `stale_parser_version_clothing`: 109
  - `stale_parser_version_clothing_residue`: 91
  - `sku_median_unavailable`: 80
  - `negative_resell_gap`: 50

신발도 같은 구조다.

- shoe eligibleReady: 47
- shoe eligibleInvalidated: 613
- shoe eligibleNoPool: 18,763
- shoe parser current backlog: expected/emitted `wave92-shoe-v41`, 그러나 eligible parser mismatch 10,559건

판단:

- "의류 16"은 새 매물이 16개만 들어오는 문제가 아니다.
- 이전 400대 ready 는 오래된 parser/느슨한 key 기준으로 유지되던 재고가 포함되어 있었다.
- 분류 개선 자체는 헛수고가 아니다. 사용자 피드백에 나온 wrong match(말본 에센셜, 폴로 아동/여성/피케/니트 혼선, 아크테릭스/스투시/신발 broad axis 등)를 실제로 걸러내는 방향이다.
- 다만 운영 rollout 은 잘못했다. parser target sync, ready-floor circuit breaker, staged backfill 없이 cleanup 을 먼저 운영 worker 에 물려 ready stock 이 급감했다.

다음 조치:

1. score-worker lock 만료 전 hotfix 범위만 분리해 배포한다: parser target sync + ready floor guard.
2. 이후 score-worker 를 다시 열어 current parser 로 재parse/score backlog 를 순차 drain 한다.
3. 의류/shoe ready 목표치를 과거 400으로 억지 복구하지 않고, current 기준 통과 row 를 먼저 350+까지 회복시킨다.
4. `profit_below_pack_band`, `negative_resell_gap` 는 품질/경제성 gate 이므로 임의 완화하지 않는다. 완화 필요 시 별도 owner decision 으로 다룬다.

## Hotfix Apply / Reopen 2026-05-25 05:29 KST

사용자가 score-worker 를 막아둔 상태로 새 매물이 ready 로 안 들어오는 것을 지적했다. 조치했다.

적용:

- clean temp worktree 에서 `src/lib/tick-pipeline.ts` hotfix 만 분리해 `origin/main` 으로 push.
- commit `16ae76bb`: parser target sync + ready-floor circuit breaker + fashion reserve lane.
- commit `07429a71`: ready-floor 기본값을 350에서 450으로 상향.
- Vercel cron host 가 `minyoi-jvstgyeug...` 이후 `minyoi-d82ohfvcj...` 로 바뀌며 새 배포 반영 확인.
- emergency `score_worker` DB lock 은 과거 lease 로 밀어 해제했다.
- 운영 score-worker 는 새 배포본에서 다시 돌기 시작했다.

회복:

- local fixed `scoreStage` 여러 차례 실행.
- parser drift requeue 로 stale parser backlog 를 score_dirty 로 재표시.
- ready 213 → 369까지 회복.
- category ready:
  - shoe: 102
  - clothing: 73
  - earphone: 57
  - smartphone: 32
  - tablet: 25
  - smartwatch: 22
  - drone: 14
- band ready: band1 217, band2 69, band3 83.

운영 확인:

- 최신 score-worker host: `minyoi-d82ohfvcj-securemj0411-7703s-projects.vercel.app`
- 최신 score-worker run:
  - `score_pool_ready_floor_count`: 369
  - `score_pool_ready_floor_threshold`: 450
  - `score_pool_ready_floor_cleanup_deferred`: 1
  - `score_pool_stale_parser_post_residue_invalidated_rows`: 0
- 즉 score-worker 는 다시 열렸고, ready 450 미만에서는 cleanup성 invalidation 을 미루도록 배포 반영됐다.

남은 상태:

- Vercel score-worker 는 70-90초 run 에서 timeout 성 종료가 많아 throughput 이 낮다. 자동 회복은 켜졌지만 빠른 backfill 은 local/manual drain 이 더 빠르다.
- ready 400대까지 추가 회복하려면 같은 current parser 기준 score drain 을 더 이어가면 된다.
- stale/economic skip 의 대부분은 `negative_resell_gap`, `sku_median_unavailable`, `profit_below_pack_band` 이므로 임의 완화하지 않는다.

## Joongna Source Diagnosis 2026-05-25 05:56 KST

사용자가 "중고나라만 유독 없는 것 같다. 번장 350개면 보통 중고나라 100개 정도였는데 지금 적다"고 지적했다.

판단:

- 기분탓이 아니었다. 최초 조회 시 ready 는 `bunjang 323 / joongna 46` 수준이었다.
- 중고나라 source/API 가 죽은 것은 아니었다.
  - 최근 24h joongna eligible: 약 2,400건
  - 최근 6h joongna eligible: 약 350건
  - joongna-worker 는 계속 `succeeded`, detail queue pending 은 15건 수준이었다.
- 병목은 수집이 아니라 pool 승격/score 재평가였다.
  - 최근 6h eligible 350건 중 candidate_pool 포함은 4건뿐이었다.
  - 많은 row 는 `mvp_listing_analysis` 까지는 만들어졌지만 candidate_pool ready 로 올라오지 않았다.

원인:

- Joongna 의 `shop_review_rating` 은 실제 별점이 아니라 `sellerActivityScore + sellerReliabilityScore` 를 5점 스케일처럼 정규화한 trust score 다.
- UI/safety 레이어는 이미 "중고나라는 별점이 아니라 신뢰지수"로 안내하지만, `candidate-pool-builder` 는 이를 번장 별점과 동일하게 `3.5 미만 hard block` 으로 처리했다.
- 그 결과 joongna 후보가 source 특성상 과도하게 탈락했다.

조치:

- `hotfix: stop treating joongna trust as star rating`
  - 번장 별점 hard block 은 유지.
  - joongna trust score 는 pool hard block 이 아니라 buyer caution signal 로 남김.
  - 관련 회귀 테스트 추가.
- `hotfix: reserve more score capacity for joongna`
  - score queue 에서 joongna reserve 를 고정 100개에서 `limit * 25%` 비례 lane 으로 확대.
  - fashion/parser backlog 가 커도 joongna 가 계속 scoreStage 에 들어오도록 보강.
- 최근 24h joongna eligible 중 low-trust gate 로 빠졌던 후보 970건을 `score_dirty=true` 로 재큐잉.
- local score drain 을 여러 차례 수행했다.
  - 1차: scored 945 / poolUpserted 41
  - 3차: scored 972 / poolUpserted 22
  - 4차: scored 964 / poolUpserted 25

결과:

- 중간 peak: ready `bunjang 363 / joongna 82`, total 445.
- production score-worker 와 병행 재평가 후 안정 확인 시점: ready `bunjang 374 / joongna 53`, total 427.
- 즉 source dead 문제는 아니며, 과도한 joongna trust hard block 은 제거했지만, 최종 ready 는 경제성/시세 gate 에 의해 다시 걸러졌다.

남은 해석:

- "번장 350이면 중고나라 100"이 항상 유지되던 과거 상태에는 느슨한 seller/trust 해석 및 stale parser 재고가 섞여 있었을 가능성이 높다.
- 현재 조치 후에도 joongna 가 50대에 머무는 이유는 raw 부족이 아니라 `negative_resell_gap`, `sku_median_unavailable`, `profit_below_pack_band` 가 대다수이기 때문이다.
- 추가로 100개대까지 올리려면 joongna source 자체보다 market sample/stat coverage, 특히 joongna clothing/shoe 의류/신발 시세 coverage 를 확장해야 한다.

Deferred:

- `negative_resell_gap`, `profit_below_pack_band`, `sku_median_unavailable` 자체를 완화하지 않았다.
- 중고나라 신뢰지수를 완전히 무시하지 않는다. pack/detail UI 에서는 계속 buyer caution 으로 표시한다.
