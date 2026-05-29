# Wave 941 — Tech Condition Deep Sweep

Date: 2026-05-29

## Context

사용자 피드백: 휴대폰/태블릿/워치/노트북/스피커/드론 등 기술 제품에서 실제 하자 문구가 `상태 보통` 또는 정상 계열로 남으면 안 된다. 특히 `액정 파손 말고는 문제 없음`, `화면 멍입니다`, `액정 교체 한 번`, `이상한 소리하면 차단`처럼 문맥에 따라 정반대로 해석되는 표현을 카테고리별로 검증해야 한다.

## Decisions

- `tech-device-condition-evidence`를 `v7`, `option-parser`를 `v69`로 올렸다.
- 드론/액션캠의 거래 정책 문구를 기기 하자로 보지 않도록 분리했다.
  - `교환/환불/약속 파토 불가`는 카메라 사용 불가가 아니다.
  - `이상한 소리하면 차단`은 스피커 이상이 아니다.
  - `사진에 있는 흰점은 먼지`는 화면 흰점 하자가 아니다.
- 스피커/오디오 정상 문구를 보강했다.
  - `문제 없이 노래도 잘 나옴`, `문제1도없어요`, `음질/소리 문제 없음`은 speaker/mic issue가 아니다.
- 실제 화면 하자 문구는 일반 정상 문구가 붙어도 하자로 유지한다.
  - `액정 약간 파손 말고는`, `액정 살짝 깨진것 말고는`, `화면 깨져있습니다 그 이외`, `액정 깨짐 외에는`, `화면 왼쪽 멍입니다`, `화면이 흐려지는 현상`.
- 필름/보호유리 하자는 본체 액정 하자로 올리지 않는다.
  - `필름이 깨진거`, `화면 깨짐같은 건 필름`, `보호필름 공기 때문에 화면깨진거처럼 보임`.
- `액정 교체 한 번 했고 깨진 부분 없음`은 "교체 없음"이 아니라 실제 화면 수리 이력으로 본다.

## Sweep Results

- `speaker`: 390 parsed rows, false-positive cleanup 후 candidate 0.
- `monitor`: 128 parsed rows, candidate 0.
- `camera`: 183 parsed rows, candidate 0.
- `desktop`: 502 parsed rows, candidate 0.
- `small_appliance`: parsed row 0.
- `home_appliance`: candidate 1, 실제 다이슨 배터리/충전 하자이며 이미 `flawed`.
- `drone`: 1,147 parsed rows, 거래 문구 false-positive 제거 후 실제 `액정나감` 계열만 남음. 남은 샘플은 이미 `flawed`.
- `smartphone/tablet/smartwatch/laptop`: runtime parser 보강은 적용했지만, deepsweep의 `display_panel_issue_broad`/`functional_component_issue` learned tag는 정상 부정문까지 긁는 노이즈가 남아 있음.

## Deferred

- `report-smartphone-condition-deepsweep.ts`의 learned broad tag는 탐색용 리포트로만 유지한다. 현재 노이즈가 커서 `ready` 게이트나 자동 invalidation 조건으로 쓰면 안 된다.
- DB reparse/replay는 별도 wave로 진행한다. 이번 wave는 parser/evidence logic과 테스트 보강까지만 포함한다.
- 카테고리별 LLM 상태 파싱은 비용/지연/검증 설계가 필요하므로 이번 wave에서는 도입하지 않았다.

## Verification

- `npx tsx --test tests/tech-device-condition-evidence.test.ts`
- `npx tsx --test tests/tech-device-condition-evidence.test.ts tests/core-rules.test.ts`
- `npm run build`
- parsed deepsweep:
  - `speaker`, `drone`, `smartphone`, `tablet`, `smartwatch`, `laptop`, `monitor`, `camera`, `desktop`, `home_appliance`, `small_appliance`
