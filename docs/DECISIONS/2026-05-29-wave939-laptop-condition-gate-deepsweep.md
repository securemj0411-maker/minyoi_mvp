# Wave 939 — Laptop Condition Gate Deep Sweep

Date: 2026-05-29

## Decision

노트북 매물도 smartphone/tablet/smartwatch와 같은 tech-device condition evidence gate에 연결한다.

적용한 신호:
- 디스플레이/패널 깨짐, 크랙, 픽셀 깨짐 → `display_defect`
- 프레임/모서리 구조 파손 → `device_body_damage`
- 충전 불량/전원 연결 필수 → `device_charging_or_sensor_issue`
- 스피커 찢어지는 소리/잡음 → `repair_or_defect_signal`
- 배터리 `신품대비 N%`, `서비스 권장됨` → `low_battery_health`

## False Positive Guards

아래 노트북 정상 표현은 결함으로 보지 않는다.
- `램 교체 불가능` 같은 공식 스펙표 문구
- 썬더볼트/USB 단자 개수 또는 지원 안내
- 터치바/터치패드 A급, 깨끗함, 정상 작동
- 키보드 지문/외관 지문 같은 오염 표현
- `크랙버전` 같은 소프트웨어 표현
- 공식 애플스토어/센터의 배터리·키캡·키보드 교체 이력과 화면 정상 문구
- 사설 수리내역 `당연히 없음` 같은 부정형 문구

## Verification

- `npx tsx --test tests/tech-device-condition-evidence.test.ts tests/core-rules.test.ts`
  - 165 pass, 0 fail
- Laptop deep sweep over 3,000 parsed rows rerun.
  - Remaining `functional_component_issue` samples are mostly report broad-pattern noise such as `램 교체 불가능`, `터치스크린 탑재`, `교환/환불 불가`.
  - Parser now keeps those as normal/clean/unopened/worn instead of flawed.

## Deferred

- Deep-sweep report broad tags need a separate precision pass so `functional_component_issue` no longer flags normal spec-table text.
- Laptop ready replay/backfill is separate from parser deploy. Parser version bump to `option-parser-v66` should let normal drift/reparse jobs pick it up.
