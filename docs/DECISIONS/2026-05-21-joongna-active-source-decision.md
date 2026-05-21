# 2026-05-21 Joongna Active Source Decision

## 결정

- 중고나라는 단순 실험 소스가 아니라 번개장터와 함께 상시 편입할 marketplace source로 가져간다.
- 번개장터를 대체하지 않는다. 번개장터는 전자기기/브랜드 패션/리셀형 SKU의 주 source로 유지하고, 중고나라는 pool 보강과 sparse lane 확장 source로 붙인다.
- 기존 catalog, mining, option parser, candidate pool, market math, lifecycle 파이프라인을 새로 만들지 않는다. 중고나라 payload를 기존 내부 listing contract로 정규화하는 source adapter를 추가하는 방식으로 간다.
- DB/API/UI 전 구간에서 marketplace source를 first-class 필드로 유지한다. 사용자와 운영자가 나중에 "번개장터 매물인지 / 중고나라 매물인지"를 구분할 수 있어야 한다.

## 현재 코드/스키마 확인

- `mvp_raw_listings`에는 이미 `source text default 'bunjang'`, `seller_source text default 'bunjang'`가 있다.
- `mvp_listing_observations`에도 `source text default 'bunjang'`가 있다.
- `src/lib/joongna.ts`에는 source-mode guard, block signal detection, transparent probe, deterministic internal pid mapping(`joongnaInternalPid`)이 이미 있다.
- 현재 큰 제약은 `mvp_raw_listings.pid bigint primary key` 단일 PK 구조다. 중고나라 원본 id를 그대로 쓰면 번개장터 pid와 충돌할 수 있으므로, 단기에는 source별 내부 pid 매핑이 필요하다.

## 구현 방향

- `MarketplaceSourceAdapter` 계층을 둔다.
  - `bunjang` adapter: 기존 `SearchItem`/`DetailData`를 거의 그대로 통과.
  - `joongna` adapter: 중고나라 검색/상품 payload를 title, price, url, thumbnail, seller, comment/chat count, observed/update time, raw_json으로 정규화.
- ingest/upsert 시 `source='joongna'`, `seller_source='joongna'`를 반드시 쓴다.
- 원본 id는 단기적으로 `raw_json.sourceExternalId`에 보존하고, 가능하면 후속 migration에서 `source_external_id text` 컬럼과 `(source, source_external_id)` unique index를 추가한다.
- 사용자/운영자 표시 URL은 `pid` 하드코딩 대신 source-aware link builder로 바꾼다.
  - 번개장터: `https://m.bunjang.co.kr/products/{external pid}`
  - 중고나라: 원본 상품 URL
- pool, market-source, /me, admin views는 출처 뱃지/필터를 표시할 수 있게 응답에 `source`를 포함한다.

## 보류/주의

- 중고나라 active write는 adapter contract, source-aware URL builder, 최소 no-write 샘플 리포트가 통과한 뒤 켠다.
- schema를 곧바로 `(source, external_id)` 복합 PK로 갈아엎지는 않는다. 현 구조 영향 범위가 크므로 단기 내부 pid mapping 후, 별도 migration으로 점진 전환한다.
- 차단/429/비정상 접근 신호가 감지되면 회피하지 않고 즉시 중고나라 source를 끈다.
- 중고나라 물량은 전체 플랫폼으로는 크지만, 전자기기/브랜드 SKU 검색에서는 번개장터보다 적은 케이스가 많다. 따라서 기대치는 "pool 2배"가 아니라 sparse lane 보강과 카테고리 확장으로 둔다.

## 다음 작업

1. 중고나라 no-write search/detail sample runner를 만든다.
2. 중고나라 payload를 내부 listing contract로 정규화하는 adapter를 만든다.
3. source-aware URL/link builder를 추가하고 기존 번장 하드코딩 지점을 교체한다.
4. DB migration 후보를 검토한다: `source_external_id`, source별 unique index, source-aware indexes.
5. `/me`, 상세, admin pool에서 출처 뱃지/필터를 노출한다.

## 2026-05-21 현재 상태 확인

- `vercel.json`에는 아직 중고나라 전용 cron route가 없다.
- `mvp_raw_listings`에서 `source='joongna'` row는 0건이다.
- `mvp_collect_runs`에서도 중고나라 관련 cron/collect run은 0건이다.
- `mvp_source_health`에도 `source='joongna'` row는 아직 없다.
- no-write probe는 성공했다:
  - robots.txt 200
  - `sitemap-recent-product-index.xml.gz` 200
  - recent product sitemap 1개에서 상품 URL 10개 샘플 확인
  - 차단/429/CAPTCHA 신호 없음
- no-write 상세 HTML 샘플도 200으로 읽혔고, Next payload에서 `productTitle`, `productPrice`, `categoryName`, `productStatus`, `parcelFeeYn`를 추출할 수 있었다.
- 결론: 중고나라는 아직 cadence를 타고 DB에 들어오는 상태가 아니다. 현재는 안전장치와 no-write probe 단계이며, 다음 구현은 ingest route + adapter + source-aware upsert다.

## 2026-05-21 Ingest 1차 구현/검증

- 구현:
  - `src/lib/joongna.ts`에 search page product URL 추출, detail HTML parser, detail fetch helper를 추가했다.
  - `src/lib/joongna-ingest.ts`를 추가해 중고나라 detail을 기존 내부 raw listing contract로 정규화한다.
  - `/api/cron/joongna-worker` route를 추가했다.
  - `vercel.json`에 `/api/cron/joongna-worker`를 `3,18,33,48 * * * *`로 등록했다.
  - 로컬/운영 수동 검증용 `npm run run:joongna-ingest` 스크립트를 추가했다.
- 안전장치:
  - `JOONGNA_SOURCE_MODE=off`면 route는 DB write 없이 collect log에 skipped로 남긴다.
  - `active` 모드 write는 `source='joongna'`, `pool_eligible=true`, `score_dirty=true`로 저장한다.
  - candidate pool 직접 삽입은 하지 않고 기존 score/pool pipeline 평가를 태운다.
  - 차단/429/CAPTCHA 신호가 있으면 `mvp_source_health.status='unhealthy'`로 남길 수 있게 했다.
- 실제 DB active write 테스트:
  - command: `JOONGNA_SOURCE_MODE=active ... npm run run:joongna-ingest -- --query=에어팟맥스 --maxDetails=3 --detailsPerQuery=3`
  - result: `searchUrls=3`, `fetchedDetails=3`, `rawUpserted=3`, `parsedUpserted=2`, `observationInserted=3`
  - `mvp_source_health(source='joongna')`: `healthy`, reason `active_ingest_ok`
  - 최신 저장 row는 `query='joongna_active'`, `detail_status='done'`, `listing_state='active'`, `pool_eligible=true`, `score_dirty=true`였다.
- 다음 작업:
  - Vercel production env에 `JOONGNA_SOURCE_MODE=active`와 `JOONGNA_INGEST_*` 값을 업로드해야 Vercel Cron에서 실제 ingest가 시작된다.
  - 운영 후 `mvp_source_health`/`mvp_raw_listings`/`mvp_candidate_pool`를 확인해 차단 신호와 score/pool 유입을 본다.
  - source badge와 source-aware link builder를 붙인다.

## 2026-05-21 Active 전환

- 사용자 결정: 중고나라는 오늘부터 운영 source로 켠다. 사전검증 단계에 머물지 않는다.
- env 기준을 `JOONGNA_SOURCE_MODE=active`로 전환했다.
- active mode 동작:
  - `source='joongna'`
  - `pool_eligible=true`
  - `score_dirty=true`
  - 기존 score stage/candidate_pool builder가 중고나라 row를 평가한다.
- cron path는 `/api/cron/joongna-worker`로 정리했다.
- env upload용 `.env.local`에는 active 설정을 추가했다.
- 신규 운영 env는 `JOONGNA_INGEST_*`를 사용한다.

## 2026-05-21 운영 재배포 후 확인

- owner가 Vercel env 업로드 후 redeploy를 실행했다.
- 운영 `/api/cron/joongna-worker` 수동 호출 결과:
  - status 200
  - `mode='active'`
  - `rawUpserted=1`, `parsedUpserted=1`, `observationInserted=1`
  - `sourceHealthStatus='healthy'`, `sourceHealthReason='active_ingest_ok'`
- Vercel Cron 자동 실행도 확인했다:
  - `/api/cron/joongna-worker`, trigger `vercel-cron/1.0`, status `succeeded`
  - collected/upserted 12
- 운영 DB 최신 중고나라 row 확인:
  - `source='joongna'`
  - `query='joongna_active'`
  - 신규 row는 `sale_status='ACTIVE'`
  - `pool_eligible=true`
  - `score_dirty=false`까지 내려간 row 확인
- score drain 병목 보강:
  - `/api/cron/score-worker`를 추가하고 `* * * * *`로 등록했다.
  - score drain이 번개장터 last_seen row에 밀리지 않도록 `scoreStage`에서 `source='joongna'` dirty row를 먼저 일부 reserve한다.
  - 중고나라 `productStatus=0`은 active sale로 정규화하고, 기존 `JOONGNA_STATUS_0` row도 pool policy에서 active로 인정한다.
- 운영 score-worker 확인:
  - 자동 score-worker run들이 `scored`, `upserted`, `poolUpserted`를 발생시키는 것 확인.
  - 수동 score-worker 호출도 status 200, `scored=205`, `poolUpserted=9` 확인.
  - 최신 Joongna AirPods Max row 중 `candidate_pool.status='ready'`, `profit_band=3`, 예상 차익 약 79,695원 row 확인.
- 주의:
  - score-worker는 현재 70초 예산 + 90초 lease로 크게 도는 중이라 1분 cron에서 일부 run이 collect log 상 `running`으로 잠깐 남을 수 있다.
  - DB lock과 lease가 있어 다음 run을 영구적으로 막는 구조는 아니지만, 운영 로그에서 `running` stale이 계속 쌓이면 score batch size 또는 cron 간격을 조정한다.

## 2026-05-21 Tick degraded 알림 후 조치

- Telegram `tick degraded` 계열 알림 원인:
  - 중고나라 source는 `healthy`.
  - 번개장터 source health가 `tick_failure_rate_elevated`로 degraded.
  - 최근 `/api/cron/tick` run 다수가 `stale running run auto-marked after 3m`로 실패 처리됨.
- 판단:
  - score-worker를 분리했지만 `/api/cron/tick`이 여전히 search 뒤에 inline `scoreStage`를 실행하고 있었다.
  - `scoreStage`는 deadline 체크 전에 최대 800건 기준 DB preload/parse/market stat fetch를 먼저 수행하므로, tick 90초 안에 끝나지 않는 run이 발생했다.
- 조치:
  - tick의 inline score는 기본 OFF로 바꿨다. (`PIPELINE_TICK_INLINE_SCORE_ENABLED=1`이면 rollback 가능)
  - score 전용 worker가 scoring을 담당한다.
  - 기본 score batch limit을 800 → 300으로 낮췄다.
  - score-worker budget cap을 70초 → 55초로 낮춰 1분 cron cadence와 충돌을 줄였다.
- 검증:
  - `npx eslint src/lib/pipeline-config.ts src/lib/tick-pipeline.ts src/app/api/cron/score-worker/route.ts` 에러 없음. 기존 `trimmedSellerMarket` unused warning만 유지.
  - `npm run build` 성공.
- 후속:
  - 배포 후 tick은 1분마다 search-only로 빠르게 성공해야 한다.
  - source health는 recovery hysteresis 때문에 즉시 healthy가 아니라 약 15분 이상 정상 run이 누적된 뒤 회복될 수 있다.
