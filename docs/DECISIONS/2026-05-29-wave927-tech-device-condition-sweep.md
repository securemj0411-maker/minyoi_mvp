# Wave 927 — 스마트폰/태블릿/스마트워치 상태 evidence sweep

Date: 2026-05-29

## 결정

- 이어폰 다음 상태 deep sweep 대상은 `smartphone`, `tablet`, `smartwatch`로 잡는다.
- 이번 wave에서는 runtime parser output이나 candidate_pool을 바꾸지 않는다.
- 먼저 카테고리 공통 evidence parser와 no-write 운영 sweep으로 실제 ready/reserved 누수만 측정한다.
- Supabase changelog 확인 결과, 이번 read-only REST 조회/기존 table 접근에 직접 영향을 주는 변경은 적용하지 않았다.

## 구현

- 추가 파일:
  - `src/lib/condition-evidence/tech-device.ts`
  - `tests/tech-device-condition-evidence.test.ts`
  - `scripts/report-tech-device-condition-evidence-sweep.ts`
- parser는 아래 신호를 구조화한다.
  - hard candidate: 화면/터치/액정교체/Face ID/카메라/스피커·마이크/계정잠김/통신·할부 리스크/침수/부품용/사설·부분수리
  - warning: 배터리 저하/사이클 과다/생활기스/구성품 누락
  - positive: 배터리 고효율/100%, 초기화·계정 해제, 공식 리퍼, 보증

## False positive 보정

- 1차 sweep에서 아래 false positive를 발견하고 parser를 좁혔다.
  - `스피커 기능 전부 이상무` → speaker/mic issue 오탐
  - `액정 깨진 곳 없이 깨끗` → display issue 오탐
  - `일본 아이폰이라 카메라 기본 무음` → camera issue 오탐
  - `통신사 약정으로 셀룰러 사용 불가, GPS 모드만 가능` → carrier risk 오탐
- 보정 후 이 케이스들은 단위 테스트로 고정했다.

## 운영 DB no-write sweep 결과

- 대상: candidate_pool `ready,reserved` 중 `smartphone,tablet,smartwatch`
- pool rows: 504
- hard candidate: 2 (0.4%)
- warning-only: 161 (31.9%)
- category:
  - smartphone: 358 / hard 2
  - smartwatch: 75 / hard 0
  - tablet: 71 / hard 0
- hard signal:
  - `unofficial_or_partial_repair`: 1
  - `carrier_or_finance_risk`: 1
- hard sample:
  - `아이폰14프로Pro 128G블랙 *배터리사설수리`
  - `아이폰 17 프로 실버 256 미개봉 판매합니다.` — `확정기변 불가능`

## 보류

- 이번 wave에서는 `parseListingOptions()` parsed_json에 tech device evidence를 저장하지 않는다.
- pool gate 연결도 하지 않는다.
- 이유:
  - hard 후보가 0.4%로 낮고, 배터리/사이클 warning이 훨씬 큰 비중이다.
  - 이 영역은 차단보다 가격 보정/구매 전 질문/상세 UX 반영이 더 맞는 신호가 많다.
  - 다음 wave에서 `tech_device_condition_*` shadow 저장부터 붙이는 편이 안전하다.

## 다음 작업

1. `parseListingOptions()`에 `tech_device_condition_evidence/signals/policy` shadow 저장을 연결한다.
2. hard signal 중 `unofficial_or_partial_repair`, `carrier_or_finance_risk`를 pool gate로 쓸지 별도 sample review 후 결정한다.
3. warning-only 신호는 상세/쉬운모드에서 구매 전 체크와 가격 보정 후보로 반영한다.

## 검증

- `npx tsx --test tests/tech-device-condition-evidence.test.ts`
  - 15 pass / 0 fail
- `npx tsx scripts/report-tech-device-condition-evidence-sweep.ts --limit=5000 --statuses=ready,reserved --categories=smartphone,tablet,smartwatch`
  - no-write report generated
- `npx tsx --test tests/tech-device-condition-evidence.test.ts tests/core-rules.test.ts tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts`
  - 156 pass / 0 fail
- `npm run build`
  - pass
