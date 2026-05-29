# Wave 948 — Fashion Condition Deep Sweep

Date: 2026-05-30

## Decision

신발/의류/가방 ready/reserved pool을 상태 표현 기준으로 다시 훑고, 실제 매물 문장에 나온 오염/이염/얼룩/색바램/늘어남 negation 패턴을 parser와 5축 condition_grade에 같이 반영했다.

이번 wave의 핵심 원칙은 단어 하나만 막는 클루지가 아니라, 같은 의미 표현군을 parser note, condition_class, condition_grade tier, UI chip까지 같은 방향으로 정렬하는 것이다.

## Implemented

- 신규 audit script 추가: `scripts/report-fashion-condition-deepsweep.ts`
- 신발:
  - `약간의 얼룩있어`, `이염 있습니다`, `오염있지만`, `미세 오염` 등 변형 감지.
  - `shoe_stain_or_discoloration` + `cosmetic_wear` note 부여.
  - 5축 damage minor/major keyword에 실제 ready 문장 변형 추가.
- 의류:
  - `살짝 오염있지만`, `미세 오염 있는데`, `작은 오염 있습니다` 감지.
  - `색 바램없고`, `목 늘어남 심하지 않음`, `큰 오염 및 하자 없음`은 false positive 방지.
  - 오염/색바램/늘어남 계열은 `cosmetic_wear`도 같이 붙여 condition_class가 너무 높게 남지 않게 함.
- UI:
  - condition_notes 기반 chip에 패션 하자 근거 추가.
  - condition_grade chips에 `damage:minor`, `damage:major`를 노출해 C/D급 이유가 숨지 않게 함.

## Verification

- `npx tsx scripts/report-fashion-condition-deepsweep.ts --categories=shoe,clothing,bag --statuses=ready,reserved --limit=5000`
  - poolRows: 1718
  - suspiciousHighGradeRows: 0
  - learnedWithoutCurrentNoteRows: 0
- `npx tsx --test tests/wave254-5-fashion-condition.test.ts`
  - 50 pass, 0 fail
- `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/fashion-parser-version-sync.test.ts tests/core-rules.test.ts`
  - 170 pass, 0 fail
- `npm run build`
  - passed

## Deferred

- `tests/fashion-catalog-regression.test.ts` 전체 실행에서 기존 카탈로그 라우팅 2건이 실패한다.
  - New Balance Auralee collab route
  - Arc'teryx Alpha SV route expectation
- 이번 wave는 상태 파싱/상태 chip 정합성 작업이므로 위 카탈로그 라우팅 실패는 별도 catalog wave에서 다룬다.

