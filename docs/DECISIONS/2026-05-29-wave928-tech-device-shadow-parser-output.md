# Wave 928 — Tech device evidence parser output shadow 저장

Date: 2026-05-29

## 결정

- Wave 927의 스마트폰/태블릿/스마트워치 condition evidence parser를 `parseListingOptions()` output에 shadow 저장한다.
- 이번 wave에서도 candidate_pool gate는 연결하지 않는다.
- policy mode는 `shadow_only`로 둔다.
- `PARSER_VERSION`은 올리지 않는다.
  - 이유: parsed_json 관측 필드 추가만으로 전체 stale parser churn을 만들지 않기 위해서다.

## 구현

- 대상 카테고리:
  - `smartphone`
  - `tablet`
  - `smartwatch`
- `parsed_json` 신규 shadow fields:
  - `tech_device_condition_evidence`
  - `tech_device_condition_signals`
  - `tech_device_condition_policy`
- policy payload:
  - `version`
  - `mode: "shadow_only"`
  - `hard_block_candidates`
  - `warning_signals`
  - `positive_signals`

## 보류

- `unofficial_or_partial_repair`, `carrier_or_finance_risk`를 pool gate로 연결하지 않았다.
- battery warning은 pool block이 아니라 상세/쉬운모드 가격 보정 또는 구매 전 질문 후보로 남긴다.
- 기존 row reparse/backfill도 하지 않았다.

## 검증

- `npx tsx --test tests/tech-device-condition-evidence.test.ts`
  - 17 pass / 0 fail
- `npx tsx --test tests/core-rules.test.ts tests/tech-device-condition-evidence.test.ts tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts`
  - 158 pass / 0 fail
- `npm run build`
  - pass
