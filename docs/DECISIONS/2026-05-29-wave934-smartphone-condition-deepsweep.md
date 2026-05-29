# Wave 934 — Smartphone Condition Deep Sweep

Date: 2026-05-29

## Decision

휴대폰 상태 deepsweep은 이전 wave에서 완료된 것이 아니었다. Wave 927/928의 tech-device condition evidence는 shadow/report 성격이었고, 실제 pool gate에는 `뒷판/후면유리 파손`, `폴더블 힌지/내부액정 반점`, `접으면 화면 나감` 같은 휴대폰 특화 표현군이 연결되지 않았다.

이번 wave에서는 ready/reserved smartphone pool을 no-write sweep으로 훑고, 발견된 한국어 손상 표현군을 보수적으로 런타임 파서와 pool gate에 연결했다.

## Applied

- `tech-device-condition-evidence-v2` 추가:
  - `body_or_back_glass_damage`
  - `foldable_hinge_or_inner_damage`
  - 기존 `display_panel_issue` 보강: 검은점/검은색 반점/내부 LCD 멍/접으면 화면 나감
- `option-parser-v63`:
  - tech-device evidence를 더 이상 shadow-only로 두지 않고 `condition_gate_v1`로 저장
  - `device_body_damage`, `foldable_hinge_damage`를 flawed/pool block note로 연결
- `pipeline.damagedHits()`:
  - SKU 매칭 전에도 휴대폰 구조 손상 표현을 damaged로 제외
- 오탐 방지:
  - `액정 깨끗`, `후면 깨끗`, `카메라 무음`, `스피커 이상 없음`, `무잔상 + 내부 LCD 멍 있음` 케이스를 회귀 테스트에 추가
  - 기존 `액정 깨...` bare stem이 `액정 깨끗`을 display defect로 오탐하던 문제 제거

## Sweep Result

Report: `reports/smartphone-condition-deepsweep-latest.json`

- Initial no-write sweep before runtime fix:
  - candidateRows: 71
  - missedByCurrentEvidence: 60
  - conditionStillNormal: 68
- After parser/gate fix:
  - candidateRows: 33
  - missedByCurrentEvidence: 0
  - conditionStillNormal: 31

`conditionStillNormal`은 현재 DB에 저장된 예전 parsed row 기준이다. `PARSER_VERSION`을 v63으로 올렸으므로 배포 후 reparse/drift path가 돌면 해당 row들은 새 condition gate를 타게 된다.

## Deferred

- AI L2로 “문제 살짝 있는데 큰 문제는 없음” 같은 애매한 기능 결함을 판정하는 작업은 보류했다. 이번 wave는 명확한 구조 손상/디스플레이 결함만 deterministic gate로 반영했다.
- 스키마 변경은 하지 않았다.
