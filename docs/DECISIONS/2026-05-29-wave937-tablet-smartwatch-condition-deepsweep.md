# Wave 937 — Tablet/Smartwatch Condition Deepsweep

Date: 2026-05-29

## Context

User found real condition defects still appearing as normal-ish feed cards, especially phrases like "가운데 힌지부분 검은색 반점", "뒷판 깨짐", and tablet/watch descriptions where seller text said the device had screen/body faults but also "작동 정상".

Previous smartphone/earphone gates were not enough for tablet/smartwatch wording. The goal was not to add one-off blocks, but to learn repeated marketplace phrasing and route real hardware defects into condition chips/FLAWED notes while avoiding seller-policy false positives.

## Changes

- Extended `tech-device` condition evidence for tablet/smartwatch:
  - display defects: 색번짐, 붉은 반점, 화면/액정 나감, 화면X/화면 안 들어옴
  - body/frame defects: 모서리/하단부 깨짐, 휨 증상, 뒷판/후면 damage
  - charging/sensor defects: 충전단자 고장, 충전 안됨, 주변광 센서 문제
  - carrier/finance risk: 가개통, 개통된 단말기, 선약/선택약정 불가
  - activation lock: 활성화잠금/활성화 해제 불가
- Added user-facing condition chip mapping for `device_charging_or_sensor_issue` as `충전/센서 이상`.
- Reduced false positives from repeated marketplace language:
  - 사설수리 없음 / 수리 x / 하자 x / 불량 없이 정상작동
  - 충전기/충전독 없음, 시계줄/스트랩/줄 교체
  - 보호필름 금/깨짐, 화면 깨진 것처럼 보임 but actual screen OK
  - 배송 파손 동의, 판매점 고지문, 고객 부주의 파손/침수 교환 불가
  - 잔상 양호/잔상 제외 warranty language
  - 지문방지필름 not fingerprint/Touch ID failure

## Verification

- `npx tsx --test tests/core-rules.test.ts tests/tech-device-condition-evidence.test.ts tests/condition-display.test.ts`
  - 162 pass, 0 fail
- Deepsweep after final parser changes:
  - tablet parsed 3,000 rows: candidateRows 83, missedByCurrentEvidence 7, reparsedConditionStillNormal 6
  - smartwatch parsed 3,000 rows: candidateRows 64, missedByCurrentEvidence 10, reparsedConditionStillNormal 10

## Deferred

- Remaining missed samples include ambiguous cases the broad learner flags but the parser intentionally keeps conservative:
  - camera protective-glass crack where seller says shooting is unaffected
  - minor back discoloration/dent wording that may be cosmetic rather than hard block
  - watch LTE/BT-only phrasing where source variant vs carrier lock still needs source-aware policy
- A future wave should split "camera lens/protective glass damage" into its own user-facing chip instead of mapping it to generic body damage.
