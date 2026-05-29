# Wave 958 — hard chip residue cleanup

## Context

- 운영 ready/reserved condition chip audit에서 hard split row가 13건 남아 있었다.
- 샘플을 원문 기준으로 다시 보니 대부분은 실제 하드 하자가 아니라 오래된 parser 결과나 너무 넓은 `repair_or_defect_signal` 정책 때문이었다.
- 이번 작업은 DB write 없이 코드/정책/회귀 테스트만 정리했다.

## Decisions

1. `condition:repair_or_defect_signal`은 `hard_split`에서 `soft_adjustment`로 내렸다.
   - 이유: "그립 교체", "필터 교체", "새 배터리 교체", "모든 기능 정상 + 사진상 하자"처럼 정상/정비/애매한 문맥이 많다.
   - 실제 기능 고장/파손은 `display_defect`, `device_body_damage`, `camera_lens_damage`, `earphone_audio_issue` 같은 더 구체적인 hard chip으로 남긴다.
2. parser에서 정상 정비 문맥 guard를 추가했다.
   - 골프 그립 교체는 `golf_grip_new`로 유지하고 일반 수리 하자로 올리지 않는다.
   - 다이슨 필터/배터리 같은 소모품 교체가 정상 작동 문맥이면 `repair_or_defect_signal`을 붙이지 않는다.
   - "모든 기능 다 정상작동" 문맥은 일반 `하자` 단어만으로 repair hard signal이 되지 않게 한다.
3. tech condition evidence의 배터리 퍼센트 regex를 non-greedy로 고쳤다.
   - "배터리 교체로 효율 100%"가 greediness 때문에 `0%`로 읽혀 `low_battery_health`가 붙는 버그를 막았다.
4. 운영 DB에 남은 hard chip 7건은 bulk invalidate하지 않는다.
   - 현재 코드로 같은 pid들을 다시 파싱하면 hard chip이 사라진다.
   - 즉, 좋은 매물을 날릴 수 있는 stale parser residue라서 targeted reparse/refresh 대상으로 남긴다.

## Evidence

- no-write audit 재실행:
  - poolRows: 4,045
  - hardSplitRows: 13 -> 7
  - `condition:repair_or_defect_signal`: hard 6건 -> soft 6건
  - 남은 hard chip: `locked_or_lost_signal` 4, `sim_or_carrier_issue` 2, `display_defect` 1
- 남은 7개 pid 현재 parser 재확인 결과:
  - `9001662494964`: `["cosmetic_wear"]`
  - `9001823211950`: `["good_condition","cosmetic_wear"]`
  - `9001164306090`, `9001986741219`, `9001610253167`: `["good_condition"]`
  - `9002039034960`: `["full_set","cosmetic_wear"]`
  - `9003411867793`: `["new_or_open_box","carrier_status_disclosed"]`

## Verification

- `npx tsx --test tests/condition-chip-policy.test.ts tests/condition-hard-chip-residue-regression.test.ts tests/tech-device-condition-evidence.test.ts tests/option-parser-visible-damage-regression.test.ts tests/condition-policy-pool-gate.test.ts`
- `npx tsx scripts/report-condition-chip-policy-audit.ts --limit=5000 --statuses=ready,reserved`

## Deferred

- 운영 stale row 7건은 다음 parser replay/refresh wave에서 처리한다.
- `report-condition-chip-policy-audit`는 현재 DB 저장 chip만 본다. 필요하면 후속으로 "stored chip vs current parser replay" diff report를 추가한다.
