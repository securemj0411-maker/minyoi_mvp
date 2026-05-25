# Wave 809 — Shoe SKU Safety + Sample Pollution Audit

## Context
- Operator asked for a deep shoe SKU safety diagnosis because sample comparison rows were attaching unrelated products.
- Source signals used:
  - `mvp_reveal_feedback.note` operator/debug comments.
  - current `mvp_raw_listings`, `mvp_listing_parsed`, `mvp_candidate_pool`, and latest market sample counts.
  - current catalog `ruleMatch` replay for ready rows, feedback rows, and sample pollution rows.

## Findings
- Shoe catalog SKUs: 607.
- Non-empty shoe SKUs, excluding zero-product SKUs: 462.
- Public ready shoe SKUs after cleanup: 69.
- Ready SKU safety after cleanup:
  - `safe_public`: 63.
  - `probably_safe`: 6.
  - `fix_now`: 0 with ready rows.
  - `watch_internal_only`: 0 with ready rows.
- Remaining `fix_now` is `shoe-nike-dunk-low-black-white`, but it has `ready=0`; it is a future split/watch issue, not currently public.

## Decisions Applied
- Added global shoe cross-category noise for caps, collar/pique tees, cups, and tumblers.
  - This blocks same-brand non-shoe leaks such as BAPE cups/caps/카라티, MM6 Salomon caps, and ADER Converse caps/카라티.
- Added compact `Bapesta` recognition to `shoe-bape-sta`.
  - Real BAPE STA rows no longer go stale-null just because the seller writes `Bapesta`.
- Changed `puma_football` and `adidas_football` lane readiness from public `ready` to `blocked`.
  - Catalog matching remains active for raw learning.
  - Public candidate pool entry is held until explicit sub-lanes are promoted.
- Added a pool gate for shoe `-broad` / `_broad` lanes.
  - Broad shoe catalog rows can still classify raw listings, but cannot enter public pool by category or stale lane readiness.
  - Exact/collab/model lanes continue to release through `LANE_READINESS`.
- Applied DB cleanup with `scripts/apply-wave809-shoe-sku-safety-cleanup.ts --apply`.
  - 8 sample-pollution rows had `sku_id/sku_name` cleared, `pool_eligible=false`, parsed `comparable_key=null`, `needs_review=true`.
  - 6 broad football ready rows were invalidated and marked `pool_eligible=false`.
  - 1 stale raw SKU row (`402077253`) was reclassified from Yeezy Slide to Salomon RX Slide 3 while keeping its ready pool row because the comparable key already matched.

## Deferred / Watch
- Adidas/Puma football needs sub-lane promotion only after enough raw evidence:
  - Adidas: F50, Predator, Copa, X/Crazyfast, Nemeziz, Messi, with TF/FG/MG/AG axes.
  - Puma: Ultra, Future, King, with TF/FG/MG/AG axes.
- `shoe-nike-dunk-low-black-white` needs colorway/model separation before public release.
- `probably_safe` SKUs still need operator-feedback follow-up before being considered fully clean:
  - Asics Gel Kayano, BAPE STA, Yeezy Boost 350, Gucci Rhyton, Vans Style 36, Off-White Nike Blazer Mid.

## Verification
- Regenerated `reports/shoe-sku-safety-latest.md` and `.json`.
- Targeted rule/gate tests passed:
  - `npx tsx --test --test-name-pattern "recent pool sweep|shoe broad" tests/core-rules.test.ts`
- Full `tests/core-rules.test.ts` still has unrelated pre-existing failures in game console, Carhartt/clothing hold tests; those were not caused by Wave 809.
