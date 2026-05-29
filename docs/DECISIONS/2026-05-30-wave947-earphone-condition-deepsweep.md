# Wave 947 — Earphone Condition Deep Sweep

Date: 2026-05-30

## Context

Wave 946은 전체 ready/reserved 노출 풀의 확정 hard blocker 잔재를 정리했다. 이번 wave는 사용자가 예시로 든 이어폰/헤드셋 계열의 상태 표현, 특히 한쪽 유닛/소리 이상/노캔 이상/통화·연결 문제를 별도로 deep sweep했다.

## Initial Pool Sweep

새 스크립트 `scripts/report-earphone-condition-deepsweep.ts`를 추가해 Supabase raw/pool row와 현재 parser 결과를 함께 비교했다.

- scope: `candidate_pool.category=earphone`, status `ready,reserved`
- pool rows: 505
- candidate rows: 4
- current parser hard: 0
- current parser not hard: 4
- source: daangn 4

샘플 검수:

- true miss:
  - `통화할때 가끔 연결이 끊기는거 빼고는 문제 없습니다`
  - `노이즈 캔슬링 및 전화 시, 지지직 거림`
- report false positive:
  - `생활기스는 유닛쪽에 조금 있고 철가루는 아예 없어요`
  - `사운드문제없어요`

## Parser Changes

- `earphone-condition-evidence-v1` -> `v2`
- `통화/연결/블루투스 ... 끊기는/끊어짐`을 `pairing_or_connection_issue` hard signal로 추가.
- `... 끊기는거 빼고는 문제 없습니다`처럼 후행 `문제 없습니다`가 있어도 "빼고/제외/말고" 문맥이면 negation으로 보지 않게 수정.
- `지지직 ... 노이즈 캔슬링 없이`에서 `없이`를 잡음 없음으로 오인하지 않게 수정.
- `지직/찌직/찌지직` 축약형을 audio defect로 추가.
- AirPods Pro의 `노캔/주변음/통화 안됩니다`는 no-ANC variant가 아니라 하자로 처리.
- AirPods 4 등 no-ANC 가능 모델만 `노캔 안됨/없음`을 variant로 처리.
- `환불 안됩니다`, `바로구매 안됩니다` 같은 거래 조건이 노캔 문구 근처에 있을 때 ANC 하자로 오탐하지 않게 방어.
- `scripts/report-earphone-condition-deepsweep.ts`도 false-positive가 컸던 learned audit regex를 조정했다.

## Pool Cleanup

1차 patch 후:

- dry-run:
  - scanned pool rows: 501
  - candidates: 2
  - reasons:
    - `current_pool_block_earphone_condition_audio_output_issue`
    - `current_pool_block_earphone_condition_pairing_or_connection_issue`
- apply:
  - invalidated pool rows: 2
  - refreshed parser rows: 2
- postcheck:
  - candidate rows: 0

추가 raw sweep에서 AirPods 4 false positive 2건을 발견했다.

- `환불 안됩니다 / 노이즈캔슬링 됩니다`
- `노캔은 바로구매안됩니다`

이를 방어한 뒤 최종 earphone pool dry-run:

- scanned pool rows: 508
- raw rows: 508
- parsed rows: 508
- candidate rows: 0
- invalidate/reclassify/reject/refresh rows: 0

## Recent Raw Sweep

최근 7일 `mvp_listing_parsed.category=earphone` 기준 4,999개 raw row를 점검했다.

- candidate rows: 235
- current parser hard: 65
- current parser not hard: 170
- 주요 learned flags:
  - `learned_audio_issue`: 152
  - `learned_anc_issue`: 58
  - `learned_missing_unit`: 15
  - `learned_battery_or_charge_issue`: 9

not-hard 170개 중 상당수는 `지지직 없음`, `음질 문제없음`, `노캔 잘 됨`, `기능 이상없음` 같은 report-only false positive다. 이번 wave에서는 ready/reserved 노출 풀을 0으로 맞추는 데 집중했고, recent raw report의 learned regex 정밀도 개선은 다음 wave로 남긴다.

## Decision

- 이어폰/헤드셋은 한쪽 유닛/케이스 단품뿐 아니라, 실제 구매 리스크가 큰 오디오·노캔·마이크·페어링·배터리 기능 문제를 hard blocker로 유지한다.
- AirPods 4 no-ANC는 기능 하자가 아니라 모델 variant일 수 있으므로, no-ANC 문구는 모델 context가 있어야 variant로 본다.
- "문제 없습니다" 같은 후행 부정문은 문맥을 잘라 봐야 한다. `지지직 거림 ... 노캔 없이`, `연결 끊김 ... 빼고는 문제 없음`은 정상 negation이 아니다.
- 이번 wave에서는 global `PARSER_VERSION`을 올리지 않는다. 현재 generic parser version은 이어폰뿐 아니라 스마트폰/태블릿/노트북 등 여러 카테고리 stale gate에 묶여 있어, 작은 이어폰 상태 패치로 전체 generic category ready pool을 대량 stale 처리할 위험이 있다. 대신 current parser 기준으로 ready/reserved 이어폰 pool을 직접 재검증·정리했고, 신규/갱신 row는 `earphone-condition-evidence-v2`를 기록한다.

## Deferred

- 최근 raw learned report의 false-positive 170건을 더 줄이는 작업.
- AirPods 4 `기본/노캔`처럼 한 글에 여러 가격/모델이 있는 selectable listing을 별도 multi-option/bait signal로 다룰지 검토.
- 이어폰 외 다음 카테고리 deep sweep: speaker/camera/monitor 또는 fashion 상태 표현 세분화.

## Verification

- `npx tsx scripts/report-earphone-condition-deepsweep.ts --scope=pool --limit=5000 --pool-statuses=ready,reserved`
- `npx tsx --test tests/earphone-condition-evidence.test.ts tests/core-rules.test.ts` → 163 pass
- `npx tsx --test tests/earphone-condition-evidence.test.ts tests/tech-device-condition-evidence.test.ts tests/option-parser-visible-damage-regression.test.ts tests/core-rules.test.ts` → 218 pass
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=earphone --statuses=ready,reserved --reason=wave947_earphone_condition_pool_sync`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=earphone --statuses=ready,reserved --reason=wave947_earphone_condition_pool_sync --apply`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=earphone --statuses=ready,reserved --reason=wave947_earphone_condition_pool_sync_postcheck`
- `npx tsx scripts/report-earphone-condition-deepsweep.ts --scope=recent --limit=5000 --window-hours=168`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=earphone --statuses=ready,reserved --reason=wave947_earphone_condition_pool_sync_v2`
- `npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts --categories=earphone --statuses=ready,reserved --reason=wave947_earphone_condition_pool_sync_final` → candidateRows 0
- `npm run build` → pass
