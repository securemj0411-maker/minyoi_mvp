# 2026-05-21 Wave 431 — Superstar / Acne Denim Conservative Tightening

## Context
- Recent `/me` debug comments still showed fashion/shoe comparable groups mixing repeated variants.
- This wave continued the conservative strategy: only split lines with strong text signals and repeated DB samples; avoid one-off SKU explosion.

## Decisions
- Adidas Superstar:
  - Kept `슈퍼스타 II` in `shoe-adidas-superstar-broad` for now because visible repeated sample was too thin for a separate lane.
  - Blocked `Song for the Mute / 송포더뮤트 / SFTM` from plain Superstar broad because it is a collab price lane and was polluting pid `409238712` comparison samples.
  - Removed stale parsed row for pid `408995292`; raw was already `sku_id=null`.
- Acne Studios denim:
  - Added repeated denim lanes:
    - `clothing-acne-max-denim`
    - `clothing-acne-bla-konst-denim`
    - `clothing-acne-super-baggy-denim`
    - `clothing-acne-denim-shorts`
    - `clothing-acne-denim-overall`
  - Kept generic `clothing-acne-denim` for plain jeans rows without a stable model signal.
  - Fixed global token matching so `부츠컷/bootcut` denim is not rejected by the clothing-category shoe noise token `부츠/boot`.
  - Added Acne broad exclusions for the new repeated denim tokens so broad apparel does not conflict with narrow denim lanes.

## DB Writes
- Superstar:
  - Deleted stale `mvp_listing_parsed` row for pid `408995292`.
  - Deleted candidate pool row if present; none was present.
- Acne:
  - Reprocessed 104 candidate pids on the first pass and 99 on the follow-up pass.
  - First pass: `rawPatches=51`, `parsedUpserts=93`, `parsedDeletes=5`, `poolDeletes=51`.
  - Follow-up pass after broad-conflict fix: `rawPatches=13`, `parsedUpserts=92`, `parsedDeletes=0`, `poolDeletes=13`.
  - Verified key examples:
    - pid `368074395` -> `clothing|acne_max_denim|jeans|b_grade`
    - pid `394997214` -> `clothing|acne_max_denim|jeans|b_grade`
    - pid `407561571` -> `clothing|acne_bla_konst_denim|jeans|c_grade`
    - pid `348602709` -> `clothing|acne_super_baggy_denim|jeans|b_grade`
    - pid `388341977` -> `clothing|acne_super_baggy_denim|jeans|unknown_condition`
    - pid `405430445` -> `clothing|acne_denim_shorts|shorts|b_grade`
    - pid `332643525` -> `clothing|acne_denim_overall|pants|unknown_condition`
    - pid `386886016` -> cleared to null because it was a knit cardigan, not denim.

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 139 pass / 0 fail.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 177 pass / 0 fail.

## Deferred
- `슈퍼스타 II` separate SKU is deferred until repeated samples justify a distinct lane.
- Acne `1992/1995/black jean/River` sub-lanes are deferred:
  - `1992/1995` visible samples were thin.
  - `River/리버` currently risks collision with `리버스테이` and needs a stricter token strategy.
  - Black jean can be style/color rather than model; split only if repeated model-specific rows appear.
- Size-dependent sell-through/rotation grouping remains a later wave; price comparable keys still do not split by clothing size unless the parser already extracts it.
