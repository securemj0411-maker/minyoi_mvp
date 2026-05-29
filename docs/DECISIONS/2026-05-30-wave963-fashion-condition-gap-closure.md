# Wave 963 — Fashion Condition Gap Closure

Date: 2026-05-30 KST

## Context

Wave 962 added a historical parsed sweep for shoes, clothing, and bags. The first 30k parsed-row pass still showed natural-language gaps where real defects were not exposed as condition chips, especially clothing stains and bag discoloration/strap damage.

## Decision

Tightened deterministic fashion condition parsing for the recurring real seller phrases found in the 30k sweep:

- Clothing stain/discoloration:
  - `생활이염`, `옅은 이염`, `연한이염`, `이염 참고/확인`, `오염으로 저렴`, `미세 이염을 제외한`.
- Clothing structural damage:
  - `터진곳`, `박음질만`, `미세구멍`, `올풀림`.
- Bag stain/discoloration:
  - `이염이 좀`, `이염은 좀`, `생활오염정도`, `손떼 탄`, `이염상태`, `변색들이 존재`, `펜 자국`, `볼펜잉크자욱`.
- Bag damage:
  - `스트랩/끈 수선`, `크로스 끈 분실`, `어깨끈 올풀림`, `그물 튿어짐`, `상부 테두리 데미지`, generic `손상 있음` only when the text asks the buyer to check it.
- Bag hygiene:
  - `보관 냄새`, `담배 냄새`, `악취` now map to `bag_hygiene_warning` and display as the existing `냄새/위생 확인` chip.

Also tightened the deep-sweep report so it does not treat obvious non-item warnings as runtime misses:

- `생활오염과 스크래치에 강한` material copy.
- `색바램 아닌 빛 반사`.
- package/box-only damage.
- grade-table boilerplate.
- return/refund disclaimers such as `미세한 하자나 오염으로 인한 환불 불가`.

## Verification

Local unit tests:

```bash
npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/condition-display.test.ts tests/condition-chip-policy.test.ts
```

Result: 70 pass, 0 fail.

Historical parsed sweep:

```bash
npx tsx scripts/report-fashion-condition-deepsweep.ts --scope=parsed --categories=shoe,clothing,bag --per-category-limit=10000 --page-size=500
```

Final result:

- scanned parsed rows: 30,000
- finding rows: 1,541
- high-grade suspicious misses: 0
- learned signals without current note: 3

Progress during this wave:

- learned signals without current note: 79 -> 32 -> 14 -> 3
- high-grade suspicious misses: 7 -> 3 -> 1 -> 0

## Deferred

The remaining 3 rows are left as report samples because their `description_preview` is truncated around the decisive phrase. Broadening runtime regex from those fragments would increase false positives. If these repeat with full descriptions in future sweeps, prefer adding a source-detail backed parser rule or AI L2 audit instead of widening generic regex.

No schema change was made.
