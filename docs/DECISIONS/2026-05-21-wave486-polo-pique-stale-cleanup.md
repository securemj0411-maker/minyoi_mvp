# Wave 486 — Polo Pique stale cleanup

## Context

After Gucci/Chanel cleanup, latest active fashion current-diff showed `clothing-polo-pique-classic -> null` as the largest stale group.
Most rows were not Polo Ralph Lauren: Lacoste dresses, G/FORE, Carhartt WIP, Uniqlo x EG, Kapital, Nike golf, Burberry, Topten, Musinsa Standard, etc.

## Decisions

- `clothing-polo-pique-classic` now understands domestic `pk티`, `pk 티`, `카라티`, `카라 티` wording when the Ralph Lauren/Pony signal is present.
- Other-brand pique/polo/dress rows remain blocked by existing brand noise and tests.
- `clothing-moncler-broad` now blocks `피케/pique/폴로/polo/카라티/pk티`.
  - Reason: current Moncler broad is a high-price outerwear fallback (`패딩 메인`), so Moncler polo/pique shirts should not enter that comparable group until a separate lane is validated.
- DB cleanup: 72 active stale `clothing-polo-pique-classic` rows were cleared to `sku_id=null`, `sku_name=null`, `score_dirty=true`.

## Verification

- Targeted `clothing-polo-pique-classic` recheck: 113 active rows, current-diff 0
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` — pass 186/186
- `npx tsx --test tests/core-rules.test.ts` — pass 101/101

## Deferred

- Lacoste pique polo/dress, Moncler polo/pique, and generic luxury/golf pique shirts need separate lanes only after enough clean repeated samples exist.
  Until then they should stay out of Polo Ralph Lauren pricing samples.
