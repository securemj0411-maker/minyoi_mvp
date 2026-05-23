# 2026-05-22 Wave 532 — Recent Fashion Sample Replay Cleanup

## Context

After Wave 531, recent ready rows replayed cleanly, but comparing the sample rows behind those ready keys exposed another layer of pollution:

- `RRL jacket/coat` samples still included older `RRL denim jacket` parsed rows.
- One RRL tie/accessory row was still inside a jacket comparable bucket.
- Some sample rows held older condition-bucket keys from `wave216-clothing-v13` / `wave92-shoe-v11`.

## Decisions

1. Add a narrow Arc'teryx Alpha SV/AR/FL product-type rule.
   - Titles such as `아크테릭스 알파sv 새상품` now resolve to `jacket` even when the title omits `자켓`.
   - The rule runs after explicit cap/belt/wallet/pants checks, so clear accessory or alternate product-type wording still wins.

2. Clean recent comparable samples by replaying the same effective fashion SKU policy used by `tick-pipeline`.
   - Fashion sample rows are re-matched with `ruleMatch(...)` before `parseListingOptions(...)`, instead of trusting stale `raw.sku_id`.
   - This prevents old broad/fallback SKU ids from keeping polluted comparable keys alive.

3. Upsert current parsed rows for the recent fashion/shoe/bag sample set only.
   - `RRL denim jacket` samples moved to `clothing|polo_rrl_denim_jacket|...`.
   - RRL tie/accessory sample moved to a `type_unknown` reviewed row.
   - Dr. Martens 2976 sample was corrected back to `boot` by using catalog `defaultProductType`.

## Verification

- Parser regression:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 259 pass, 0 fail.
- Recent ready target replay:
  - checked 260 ready rows
  - key drift: 0
  - needs-review drift: 0
- Recent fashion/shoe/bag comparable sample replay:
  - ready keys checked: 16
  - sample rows checked: 129
  - issue count: 0

## Deferred

- Full historical parsed-row replay is still deferred. This wave intentionally cleaned only sample rows currently reachable from recent ready fashion/shoe/bag keys.
- Ready condition-class drift outside comparable key changes can be handled in a later score refresh wave.
