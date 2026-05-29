# Wave 966 — Soft Condition Profit Haircut

Date: 2026-05-30 KST

## Context

Hard condition chips now affect visible comparison proof, but soft condition chips were still mostly display-only. This could leave profit too optimistic for listings with:

- missing earphone accessories
- hygiene warnings
- low battery / high cycle hints when not already split by `low_batt`
- stains, discoloration, pilling, stretching, bag handle/corner wear, missing shoe insoles

Splitting market medians by every soft chip is not safe yet because per-SKU density is sparse. A conservative resale haircut is safer than over-splitting or hard-blocking.

## Decision

Add a centralized soft-condition resale adjustment in `src/lib/profit.ts`:

- `conditionResaleAdjustmentKrw` computes a small chip-based haircut from market price.
- The adjustment only uses soft chip policy buckets.
- It skips double-penalty cases where a broad condition class already carries the same signal:
  - `low_batt` skips `condition:low_battery_health`
  - `worn` skips `condition:cosmetic_wear`
- Total haircut is capped at the lower of 50,000 KRW or 20% of market price.

Apply the adjusted resale price in:

- candidate pool ready profit calculation
- pack open reveal profit calculation
- `/packs/pool` feed profit recompute
- `/packs/pool/detail-access` realtime detail refresh
- `/packs/me` current profit refresh
- client-side modal/dashboard/explore recomputes

This is not a hard invalidation policy. It only reduces expected profit so marginal soft-condition listings fall out naturally when costs no longer leave profit.

## Verification

Local verification:

```bash
npx tsx --test tests/condition-profit-adjustment.test.ts tests/condition-chip-policy.test.ts
npx tsx --test --test-name-pattern "comparison rows expose|market source API|condition chip policy" tests/detail-beginner-guide-contract.test.ts tests/condition-chip-policy.test.ts
npm run build
```

Result:

- condition profit tests: 8 pass, 0 fail
- targeted comparison/policy contracts: 7 pass, 0 fail
- production build: passed

## Deferred

- Exact market medians by soft chip remain deferred until density improves.
- UI cost breakdown does not yet show a separate "condition haircut" line. The adjusted profit is applied, and the chip evidence is visible; a later UX wave can expose the exact subtraction if needed.
- Existing pool rows will pick up the adjustment as workers refresh/rebuild rows; this wave does not run a destructive DB replay.
