# 2026-05-17 — condition_notes `repair_or_defect_signal` negation 확장

## 사용자 보고

- 코멘트 id=148, pid=295882994 "새상품) 갤럭시워치 울트라 47mm 화이트 팝니다" — **"이거 왜 훼손으로 분류된거야?? 훼손이라고 뜨는데?"**

## 진단

- `listing_type=normal` ✅ (오늘 아침 [listing_type 5-iter 본질 fix](2026-05-17-listing-type-classifier-precision-fix.md) 로 정상)
- 그러나 `condition_class='flawed'` (UI에서 "훼손" 표시)
- 원인: `mvp_listing_parsed.condition_notes` 에 `repair_or_defect_signal` 박힘
- 매물 desc: "거래 후 최초 원초적 **하자**(택배취급문제 등)를 제외하고는 환불 불가" — 정상 거래 조건 표현인데 "하자" 단어 매칭

### 코드 위치
`src/lib/option-parser.ts:1137` `noRepairOrDefect` regex 가 listing_type damaged negation 과 별개 — 같은 정상 표현 패턴 매칭 안 됨.

기존 negation:
- `\(\s*없는\s*수준\s*\)`
- `하자.{0,20}(?:없|아닙|아님)`
- `고장/불량/파손/깨짐/문제.{0,20}없`
- `수리/교체.{0,20}(?:없|이력없|한적없)`

매물 텍스트 "원초적 하자(택배취급문제 등)를 제외" — 위 패턴 다 못 잡음.

## 변경

- `src/lib/option-parser.ts:1138` (PARSER_VERSION v47):
  - `noRepairOrDefect` regex 끝에 추가:
    - `하자.{0,30}(?:제외|환불|책임\s*없)` — "하자(...)를 제외/환불"
    - `원초적\s*하자` — 셀러 정상 표현
    - `택배\s*취급(?:문제|상\s*문제)|택배취급문제` — 택배 사고는 거래 조건
    - `하자.{0,8}(?:있는\s*제품은\s*명시|있을\s*경우\s*환불|있는\s*경우)` — 환불 조건 표현
    - `하자나\s*오염\s*없|하자나\s*기스\s*없|하자\s*거의\s*없|하자\s*약간|하자\s*미세|심각한\s*하자\s*없|심각한\s*문제\s*없` — listing_type 본질 fix 와 동일 패턴 transfer

## 검증

- `npm run test:core` → **288/288 pass** ✅
- pid 295882994 reparse 후:
  - 이전: `condition_class='flawed'`, notes=`[new_or_open_box, repair_or_defect_signal]`
  - 지금: `condition_class='unopened'`, notes=`[new_or_open_box]` ✅
- 전체 27 batch reparse (26,513 매물) 일괄 적용.

## 위험

- 진짜 defect 매물 일부 normal 박힐 가능성 — 단, 정상 거래 조건 표현 위주로 추가했고 "하자있/하자발생/하자발견" 같은 명시적 부정 신호는 그대로 매칭. precision 손해 미미.
- `repair_or_defect_signal` 외 다른 condition_notes (display_defect, faceid_issue 등) 는 별도 mitigator 보유 — 이 patch는 repair/defect signal에만 적용.

## 다음

- listing_type damaged negation 과 condition_notes negation 통합 검토 (현재 두 곳에 같은 패턴 분산) — 중복 정의 줄이는 refactor 가능.
- 다른 condition_notes regex 도 동일 negation 검토 필요 — 사용자 코멘트 발견 시 누적 fix.
