# Wave 926 — 이어폰 상태 evidence pool gate 연결

Date: 2026-05-29

## 결정

- Wave 924/925에서 shadow로 검증한 이어폰 상태 evidence를 candidate pool gate에 연결한다.
- 단, 기존 운영 row를 갑자기 흔들지 않기 위해 `parsed_json.earphone_condition_policy.mode = "pool_gate_v1"`인 새 parser output만 gate로 사용한다.
- 기존 `shadow_only` row는 hard candidate가 있어도 이번 gate가 차단하지 않는다.
- DB mutation, reparse, 기존 ready row 일괄 invalidation은 이번 wave에서 하지 않는다.

## 구현

- `parseListingOptions()`가 이어폰 evidence를 저장할 때 policy mode를 `pool_gate_v1`로 쓴다.
- `buildCandidatePoolRows()`에 이어폰 전용 evidence gate를 추가했다.
- 차단 reason은 운영자 디버깅이 쉽도록 `earphone_condition_<signal>` 형식으로 남긴다.

## Pool 차단 신호

- `audio_output_issue`
- `anc_or_transparency_issue`
- `mic_issue`
- `pairing_or_connection_issue`
- `battery_degraded`
- `physical_damage`
- `single_side_unit`
- `charging_case_only`
- `protective_case_only`

## 명시적으로 보류한 것

- `missing_parts`, `hygiene_or_stain` 같은 warning-only 신호는 pool 진입 차단으로 쓰지 않는다.
- 기존 ready/reserved 이어폰 row의 scoped reparse/invalidation은 별도 wave로 남긴다.
- 판매 페이지 UX 문구, 체크리스트, 가격 보정 반영도 별도 wave로 남긴다.

## 검증

- `npx tsx --test tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts`
  - 26 pass / 0 fail
- `npx tsx --test tests/core-rules.test.ts tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts`
  - 141 pass / 0 fail
- `npm run build`
  - pass
