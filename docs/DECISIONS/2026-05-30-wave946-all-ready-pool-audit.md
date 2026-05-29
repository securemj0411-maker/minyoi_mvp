# Wave 946 — All Ready Pool Current Parser Audit

Date: 2026-05-30

## Context

상태 deepsweep과 category/parser cleanup 이후에도 실제 사용자에게 노출되는 `candidate_pool.status in (ready,reserved)`에 과거 파서/카탈로그/라이프사이클 잔재가 남을 수 있었다.

이번 wave는 "전 제품 상태 체계 완료"가 아니라, 현재 사용자가 볼 수 있는 ready/reserved 풀을 현재 parser/catalog 기준으로 다시 대조해서 명확히 빠져야 하는 노출 row를 정리하는 운영 점검이다.

## Actions

- `scripts/apply-cross-category-current-reparse-cleanup.ts` 전체 카테고리 dry-run
  - categories: smartphone, tablet, smartwatch, laptop, monitor, speaker, camera, desktop, home_appliance, small_appliance, drone, earphone, shoe, clothing, bag, sport_golf, game_console, lego
  - statuses: ready, reserved
  - scanned pool rows: 3,823
  - candidates: 19
- 샘플 검수 결과:
  - smartphone/tablet 18건은 현재 parser 기준 `display_defect`, `device_body_damage`, `foldable_hinge_damage`, `faceid_issue` 등 pool block이 맞음.
  - 예: 액정 검은점, 카메라 유리 파손, 후면 깨짐, 접으면 화면 나감, Touch ID 불량.
  - 1건은 SKU 누락/보정 대상.
- apply 실행:
  - invalidated: 18 rows
  - reclassify/refresh: 1 row
- postcheck:
  - scanned pool rows: 3,859
  - candidates: 0

## Additional Finding

현재 parser drift와 별도로, `mvp_raw_listings.listing_state`는 이미 terminal인데 `mvp_candidate_pool`은 아직 ready/reserved인 과거 당근 잔재가 있었다.

- 새 운영 스크립트 추가: `scripts/sync-terminal-raw-pool.mjs`
- dry-run:
  - scanned pool rows: 3,871
  - terminal raw pool rows: 61
  - source: daangn 61
  - listing_state: sold_confirmed 33, disappeared 28
  - categories: smartphone 34, earphone 9, clothing 6, smartwatch 6, laptop 2, shoe 2, drone 1, tablet 1
- apply:
  - invalidated 61 ready/reserved rows with `wave946_terminal_raw_pool_sync`
- postcheck:
  - scanned pool rows: 3,813
  - terminal raw pool rows: 0

## Tech Hard-Block Follow-Up

condition deepsweep pool report를 갱신하면서 smartphone/tablet/smartwatch ready 풀에 남은 hard condition 잔재를 추가 발견했다.

- 첫 report:
  - smartphone: carrier/display broad 후보 11건
  - tablet: 0건
  - smartwatch: carrier 1건
- 샘플 검수:
  - `정상해지. 네고불가`가 `정상해지 불가`로 오탐됨.
  - `512기가 개통통신사`가 `가개통`으로 오탐됨.
  - `완전히 잠금 해제된 상태`가 lock signal로 오탐됨.
  - report-only learned display broad가 `깨짐없어요`, `깨진 곳 없이`, `스크래치지만 문제 없음`을 과탐함.
  - 실제 hard blocker는 가개통/유심기변/확정기변 불가/Face ID 불량 6건.
- 코드 수정:
  - `tech-device-condition-evidence-v8`
  - parser version: `option-parser-v71`
  - carrier risk에서 `네고불가/협상 불가` negotiation noise 제거.
  - `가 개통` 오탐을 막기 위해 `512기가 개통통신사` 같은 storage+opened-carrier-info 문맥 방어.
  - `완전히 잠금 해제된 상태`는 lock issue가 아니라 정상 unlocked 문맥으로 처리.
  - `POOL_BLOCK_NOTES`에 objective hard blockers 추가: `sim_or_carrier_issue`, `water_damage`, `locked_or_lost_signal`, `camera_issue`, `device_charging_or_sensor_issue`, `refurbished_or_repaired`, `installment_risk`.
  - broad `repair_or_defect_signal`은 배터리 교체/내용 수정 같은 정상 문맥 오탐 위험이 있어 pool block으로 승격하지 않음.
  - report-only learned display broad negation 보강.
- DB cleanup:
  - `smartphone,smartwatch,tablet,laptop` ready/reserved dry-run: candidates 6
  - apply: invalidated 6
  - postcheck: candidates 0
- final condition reports:
  - smartphone pool: candidateRows 0
  - tablet pool: candidateRows 0
  - smartwatch pool: candidateRows 0

## Decision

- 현재 사용자 노출 대상인 ready/reserved 풀에서는 다음 두 잔재를 모두 0으로 맞췄다.
  - 현재 parser/catalog 기준 drift 또는 pool-block 잔재
  - raw terminal 상태인데 pool ready/reserved인 잔재
- tech hard blocker는 "condition_class=flawed면 자연히 점수 0으로 pool에서 빠질 것"이라는 간접 가정 대신, pool block note에서 직접 차단한다.
- 앞으로 lifecycle 경로에서 terminal 전환은 `markRawLifecycleState`가 pool invalidate를 수행하지만, 과거/외부 patch로 raw terminal만 먼저 바뀐 경우를 점검하기 위해 `sync-terminal-raw-pool.mjs`를 운영 도구로 남긴다.

## Shoe Product-Type Soft Audit

남은 soft signal인 `shoe_product_type_defaulted_to_sneaker`를 ready/reserved DB 기준으로 별도 조회했다.

- shoe ready/reserved pool rows: 630
- parsed rows: 630
- `shoe_product_type_from_shoe_default=true`: 149
- product type result: sneaker 149
- suspicious non-sneaker terms: 0
  - checked terms: boots, sandals, slides, loafers, dress shoes, heels, mules, clogs, crocs, football shoes, golf shoes, hiking/trekking shoes
- top affected SKUs:
  - New Balance 992: 14
  - New Balance 993: 12
  - Asics Superblast: 12
  - Adidas Samba Wales Bonner: 11
  - Asics Novablast: 7
  - Asics Gel Nimbus: 7

결론: 현재 ready/reserved 풀의 defaulted sneaker signal은 실제 non-sneaker 오분류 증거가 아니라, catalog defaultProductType이 명시되지 않은 정상 sneaker/running shoe SKU들이 audit signal로 잡힌 것이다. 자동 invalidation 대상이 아니며, 다음 개선은 pool 차단이 아니라 report 표현을 `safe sneaker default`와 `needs product-type split`으로 나누는 쪽이 맞다.

## Final Postcheck

전체 ready/reserved 풀을 다시 현재 parser/catalog 기준으로 dry-run 검산했다.

- scanned pool rows: 3,843
- raw rows: 3,840
- parsed rows: 3,840
- candidate rows: 0
- invalidate/reclassify/reject/refresh rows: 0

## Deferred

- "모든 제품의 상태 언어패턴이 완전 학습됨"을 의미하지는 않는다. 이번 wave는 exposed pool cleanup이고, 다음 deep work는 카테고리별 의미 패턴/AI 상태 증거 품질을 계속 늘리는 것이다.
- `apply-cross-category-current-reparse-cleanup.ts`는 전체 3.8k row 재파싱에 8분 이상 걸렸다. 다음에 자주 쓰려면 progress log, pid fast path, category batching 최적화가 필요하다.
- `shoe_product_type_defaulted_to_sneaker` 자체는 검토 완료. 다만 리포트에서 정상 sneaker default와 진짜 product-type split 필요 row를 구분하는 표현 개선은 별도 작업으로 남긴다.

## Verification

- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=smartphone,tablet,smartwatch,laptop,monitor,speaker,camera,desktop,home_appliance,small_appliance,drone,earphone,shoe,clothing,bag,sport_golf,game_console,lego --statuses=ready,reserved --reason=wave946_all_ready_pool_audit`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=smartphone,tablet,smartwatch,laptop,monitor,speaker,camera,desktop,home_appliance,small_appliance,drone,earphone,shoe,clothing,bag,sport_golf,game_console,lego --statuses=ready,reserved --reason=wave946_all_ready_pool_audit --apply`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=smartphone,tablet,smartwatch,laptop,monitor,speaker,camera,desktop,home_appliance,small_appliance,drone,earphone,shoe,clothing,bag,sport_golf,game_console,lego --statuses=ready,reserved --reason=wave946_all_ready_pool_audit_postcheck`
- `node scripts/sync-terminal-raw-pool.mjs --reason=wave946_terminal_raw_pool_sync`
- `node scripts/sync-terminal-raw-pool.mjs --reason=wave946_terminal_raw_pool_sync --apply`
- `node scripts/sync-terminal-raw-pool.mjs --reason=wave946_terminal_raw_pool_sync_postcheck`
- `npx tsx --test tests/tech-device-condition-evidence.test.ts tests/option-parser-visible-damage-regression.test.ts tests/core-rules.test.ts`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=smartphone,smartwatch,tablet,laptop --statuses=ready,reserved --reason=wave946_tech_hard_block_pool_sync`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=smartphone,smartwatch,tablet,laptop --statuses=ready,reserved --reason=wave946_tech_hard_block_pool_sync --apply`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=smartphone,smartwatch,tablet,laptop --statuses=ready,reserved --reason=wave946_tech_hard_block_pool_sync_postcheck`
- `npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=smartphone --scope=pool --limit=3000`
- `npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=tablet --scope=pool --limit=3000`
- `npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=smartwatch --scope=pool --limit=3000`
- Direct Supabase REST shoe product-type audit for ready/reserved shoe pool
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=smartphone,tablet,smartwatch,laptop,monitor,speaker,camera,desktop,home_appliance,small_appliance,drone,earphone,shoe,clothing,bag,sport_golf,game_console,lego --statuses=ready,reserved --reason=wave946_final_all_category_postcheck`
