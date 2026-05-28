# Wave 924 — 상태/하자 deep sweep 로드맵

Date: 2026-05-29

## 결정

- 상태 분류 개선은 전체 카테고리를 한 번에 AI로 덮지 않는다.
- 실제 DB 표현을 먼저 deep sweep 해서 카테고리별 상태 ontology를 만든 뒤 한 카테고리씩 적용한다.
- AI는 단순 `A급/B급` 판정자가 아니라, 구매 판단 증거를 구조화하는 evidence parser로 쓴다.

## 우선순위

1. 이어폰/헤드셋
   - 한쪽 유닛/케이스 단품/소리 이상/노캔 이상/마이크 이상/페어링/배터리/오염/구성품 누락.
2. 스마트폰/태블릿/워치
   - 액정, 잔상, 번인, Face ID, 카메라, 배터리, 수리 이력, 잠금/계정.
3. 신발/의류/가방
   - 이염, 오염, 찢김, 수선, 보풀, 변색, 구성품, 가품 신호.
4. 게임기/드론/가전/골프
   - 작동 이상, 부품용, 구성품 누락, 소모품/배터리, 수리/침수.

## 1차 DB sweep — earphone

- parsed earphone rows: 9,469
- candidate pool 상태:
  - ready 180
  - invalidated 1,220
  - spent 12
  - no pool 8,057
- 주요 표현 카운트:
  - unit_single: 124 total / ready 1
  - case_only: 192 total / ready 1
  - audio_issue: 405 total / ready 6
  - anc_issue: 356 total / ready 4
  - mic_issue: 110 total / ready 1
  - pairing_issue: 159 total / ready 2
  - battery_degraded: 26 total / ready 1
  - hygiene_stain: 335 total / ready 3
  - damaged_physical: 1,514 total / ready 25
  - missing_parts: 369 total / ready 8
- ready hard-signal sample count:
  - hard conflict candidates: 25
  - single/broken-like ready candidates: 37

## 관찰

- 현재 earphone parser는 큰 condition class는 만든다.
- 그러나 `노캔 작동시 지지직`, `마이크 약간 이상함`, `충전부 깨짐`, `본체만`, `박스 없음`, `배터리 빨리 닳음` 같은 실행 판단 신호가 ready에 일부 남는다.
- `노캔x`는 AirPods 4 기본형의 정상 옵션일 수 있으므로 `anc_issue`와 `no_anc_variant`를 분리해야 한다.
- `케이스 없음`은 case_only가 아니라 구성품 누락이다. 현재 단순 regex는 false positive가 있어 ontology와 negation/context 처리가 필요하다.

## 보류

- flawed/repair lane을 즉시 열지 않는다.
- 기능 고장/단품은 MVP에서는 비교군 분리보다 ready 차단을 우선한다.
- 가격 보정이 가능한 구성품 누락은 별도 정책을 만든 뒤 적용한다.

## 1차 구현 — earphone condition evidence shadow parser

- 추가 파일:
  - `src/lib/condition-evidence/earphone.ts`
  - `tests/earphone-condition-evidence.test.ts`
- `parseListingOptions()`는 earphone 카테고리에 한해서 `parsedJson`에 아래 shadow 데이터를 저장한다.
  - `earphone_condition_evidence`
  - `earphone_condition_signals`
  - `earphone_condition_policy`
- 정책 모드는 `shadow_only`다. 이번 wave에서는 ready gate/pool block에 연결하지 않았다.
- `conditionNotes`와 `conditionClass`에는 새 신호를 합치지 않았다.
  - 이유: 현재 `conditionNotes`는 `FLAWED_NOTES`/`POOL_BLOCK_NOTES`와 직접 연결되어 있어 새 하자 표현을 바로 넣으면 ready 풀이 운영 중 흔들릴 수 있다.
  - 기존 검증된 `single_side_only` 차단 규칙은 그대로 유지한다.
- `PARSER_VERSION`은 `option-parser-v62` 그대로 둔다.
  - 이유: shadow evidence 저장 구조 추가만으로 전체 stale parser drift를 일으키지 않기 위함.
  - 과거 row 재평가는 별도 backfill/reparse wave에서 샘플 검증 후 진행한다.

## Earphone ontology v1

- `block_candidate`
  - `single_side_unit`
  - `charging_case_only`
  - `protective_case_only`
  - `audio_output_issue`
  - `anc_or_transparency_issue`
  - `mic_issue`
  - `pairing_or_connection_issue`
  - `battery_degraded`
  - `physical_damage`
- `warning`
  - `hygiene_or_stain`
  - `missing_parts`
- `positive`
  - `full_set_positive`
  - `new_positive`
- `variant/negation`
  - `no_anc_variant`
  - `negated_defect`

## 검증

- `npx tsx --test tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts`
  - 20 pass / 0 fail
- `npx tsx --test tests/core-rules.test.ts tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts`
  - 135 pass / 0 fail
- `npm run build`
  - pass

## 다음 작업

- DB row에 shadow parser를 dry-run 적용해서 ready row 중 `block_candidate`가 몇 개인지 다시 산출한다.
- precision sample을 운영자가 확인한 뒤 다음 wave에서 `audio_output_issue`, `anc_or_transparency_issue`, `mic_issue`, `pairing_or_connection_issue`를 pool gate에 연결할지 결정한다.
- 이어폰이 안정화되면 같은 evidence 구조로 스마트폰/태블릿/워치 deep sweep을 시작한다.
