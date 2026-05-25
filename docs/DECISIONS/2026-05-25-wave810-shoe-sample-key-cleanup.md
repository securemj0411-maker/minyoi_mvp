# 2026-05-25 Wave 810 Shoe Sample-Key Cleanup

## Context

User asked to continue the shoe audit after the first safety pass, with logs, and specifically wanted sample-comparison pollution and public/internal decisions handled systematically rather than fixing one keyword at a time.

## Decisions

- BAPE STA is no longer matched by generic `sta/스타`.
  - Require explicit Bapesta phrase tokens (`bape sta`, `bapesta`, `베이프스타`, `베이프 스타`).
  - Block keychains, caps, Starbucks goods, Superstar, Instapump, SK8/Mad/Skull/Apestation/Solebox variants from the plain Bapesta SKU.
  - Parser comparable model changed from generic `sta` to `bape_sta`.
- Gucci Rhyton remains public-ready, but anniversary/limited/designer variants are blocked from the plain Rhyton SKU.
  - Added `gucci_rhyton` lane readiness so this exact model does not fall back to shoe category `internal_only`.
- Vans Style 36 remains public-ready, but Vault/OG/LX/Pop Trading/Japan premium lines are excluded from the plain Style 36 sample bucket.
- Asics Gel Kayano broad is now blocked/internal watch.
  - Reason: the raw/sample pool mixes Kayano 5/14/23/25/28/30/31/32 plus collabs. This needs exact generation lanes before public release.
- Off-White/READYMADE/Supreme/Stranger Things/Travis Nike collab shoes now keep collaborator axis in comparable keys.
  - This prevents `nike_blazer_mid`, `nike_blazer_low`, and `nike_airmax_1` sample buckets from mixing collab and plain Nike rows.
- Adidas/Puma football broad rows stay catalog-matched for learning, but cannot enter the public pool.
  - Remaining ready rows were invalidated.

## DB Backfill / Cleanup

Script: `scripts/apply-wave810-shoe-probably-safe-cleanup.ts`

First apply:

- scanned: 1,149
- changed: 1,097
- reparse key drift: 203
- reclassify to current SKU: 300
- reject/no current match: 296
- internal-only gate blocked: 298
- ready/reserved invalidated: 4

Second apply after including football broad:

- scanned: 1,561
- changed: 1,304
- internal-only gate blocked: 1,281
- reject/no current match: 23
- ready/reserved invalidated: 3

Notable corrected stale buckets:

- `shoe|sta|...` -> `shoe|bape_sta|...` or null
- `shoe|nike_blazer_mid|...` -> `shoe|offwhite_nike_blazer_mid|...` / `shoe|readymade_nike_blazer_mid|...`
- `shoe|nike_airmax_1|...` -> `shoe|travis_nike_airmax_1|...`
- stale Dunk Low Panda raw rows reclassified to `shoe-nike-dunk-low-broad` or rejected when the current catalog no longer matched.
- Kayano broad and football broad rows were retained as raw learning data but pool-gated internal-only.

## Verification

- `npx tsx --test --test-name-pattern "recent pool sweep|shoe broad|shoe sample safety" tests/core-rules.test.ts` passed.
- `npx tsx scripts/report-shoe-sku-safety.ts` after cleanup:
  - shoe catalog: 607
  - non-empty shoe SKU: 462
  - ready SKU: 66
  - `fixNow`: 0
  - ready grade counts: `safe_public=63`, `probably_safe=3`
  - ready `watch_internal_only`: 0

## Deferred

- Exact Kayano generation lanes are still needed before re-promoting Kayano public.
- Football/futsal should be split by model family and surface (`F50`, `Predator`, `Copa`, `Ultra`, `Future`, TF/FG/MG) before public.
- Remaining `probably_safe`: `shoe-yeezy-boost-350`, `shoe-gucci-rhyton`, `shoe-vans-style-36`.
  - Current deterministic pollution was patched, but they should stay on the next incoming-raw watchlist because sample count is thin and old feedback exists.
