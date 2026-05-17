# 2026-05-17 repair_or_defect_signal regex mitigator (id 146 fix)

## 사용자 코멘트

**id 146 (pid 408047887)** "에어팟 프로2 8핀 S급 풀박스":
- 매물 description: "구매하고 별로 착용하지 않아 상태 좋습니다. 하자는 채팅주시면 알려드리겠습니다. **(없는수준)**"
- 사용자: "이거 왜 분류 훼손임?? 왜 FLAWED임?"

## Root cause

`option-parser.ts:1135` regex 가 mitigator (negative context) 무시:

```ts
if (/수리|교체|하자|고장|불량|파손|깨짐/.test(defectRiskText)) add("repair_or_defect_signal", -0.2);
```

→ "하자" 단어만 잡고 "(없는수준)" 차단 신호 무시 → cc = flawed (false positive)

다른 negative 신호는 다 mitigator 박혀 있음:
- `noDisplayDefect` (line 1142)
- `noFaceIdIssue` (line 1147)
- `noWaterDamage` (line 1151)
- `noLostOrLocked` (line 1153)
- `noWhitePixel` (line 1163)

`repair_or_defect_signal` 만 **누락** — agent audit 의 "P2 regex context-blind" 의 정확한 케이스.

## Fix

```ts
const noRepairOrDefect = /\(\s*없는\s*수준\s*\)|하자.{0,20}(?:없|아닙|아님)|고장.{0,20}없|불량.{0,20}없|파손.{0,20}없|깨짐.{0,20}없|문제.{0,20}없|수리.{0,20}(?:없|이력\s*없|한\s*적\s*없)|교체.{0,20}(?:없|이력\s*없|한\s*적\s*없)/.test(lower);
if (!noRepairOrDefect && /수리|교체|하자|고장|불량|파손|깨짐/.test(defectRiskText)) add("repair_or_defect_signal", -0.2);
```

## 검증

pid 408047887 reparse:
- 이전: `notes=[full_set, good_condition, repair_or_defect_signal]` → cc = **flawed** ❌
- 새: `notes=[full_set, good_condition]` → cc = **normal** ✅
- v47 영문 enum (LIGHTLY_USED → normal) + v46 conservative `worse-of(normal, clean)` = normal

→ 사용자 컴플레인 (flawed false positive) 해결.

## 부수 검증 (id 144 v46 정확 작동)

**id 144 (pid 408107338)** "애플워치8 45mm":
- 매물: "**미개봉** 애플워치8 ... **미세한 생활기스만 조금**"
- 사용자: "우리 로직이 똑똑하게 잡은 거임??"
- 결과: `notes=[new_or_open_box, cosmetic_wear]` → cc = **worn** ✅
- v46 conservative ordering (negative 우선) 으로 worn 정확 결정

→ 사용자 의도 (배터리 89% 실사용 매물) 일치. 똑똑하게 잡음 (얻어걸린 거 X).

## Trade-off

- 새 regex mitigator 가 너무 광범위해서 진짜 repair 매물 false negative 가능
- 균형: 다른 negative 신호 mitigator 와 동일 패턴 — 검증된 형태

## 마킹

- pid 408047887 (id 146) — flawed fix
- pid 408107338 (id 144) — v46 정확 작동 확인

## Test

288/288 pass.

## Commit

`7fba0fe` parser: repair_or_defect_signal regex mitigator
