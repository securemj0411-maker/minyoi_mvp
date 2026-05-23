# 2026-05-21 Wave 436 - Supreme mesh/Nike bag cleanup

## Context

- `bag-supreme-shoulder` had become too broad after previous Supreme side-bag work.
- Actual shoulder/side bags were mixed with Nike leather shoulder bags, mesh duffles, mesh totes, generic mesh bags, cap listings containing "mesh back", and one Koss Porta Pro headphone listing.
- The main risk was bad comparable groups: caps/headphones should be null, and mesh duffle/tote/Nike shoulder should not share the generic Supreme shoulder median.

## Decisions

- Split `bag-supreme-nike-leather-shoulder` from generic Supreme shoulder.
- Split `bag-supreme-mesh-duffle` and accept common typo/variant forms:
  - `더플`
  - `더블백`
  - `더블 백`
  - `double bag`
  - `duffle` / `duffel`
- Split `bag-supreme-mesh-tote` from mesh duffle and generic shoulder.
- Add conservative `bag-supreme-mesh-bag` for small/heavy/playboy mesh bag rows, but keep it `type_unknown` + `needs_review=true` unless the product shape is explicit.
- Tighten `bag-supreme-shoulder`:
  - remove mesh/tarp wording from aliases and must-contain signals
  - block `mesh`, `nike`, `headphone`, `portapro`, cap/panel, TNF/backpack, tote, and duffle signals
- Block "5-panel / 6-panel / cap" rows so "mesh back" cap names do not enter bag SKUs.

## DB sync

- Synced target Supreme bag rows after the catalog changes.
- First sync was too narrow in the target set and temporarily cleared some `bag-tnf-supreme-backpack` rows.
- Immediately corrected the sync target set to include `bag-tnf-supreme-backpack` and re-ran the sync.
- Final verification:
  - `bag-supreme-shoulder` contaminated rows: `0`
  - Supreme mesh duffle null rows: `0`
  - Supreme/TNF backpack null rows: `0`
  - `supreme 슈프림 메쉬 더블백 23ss` restored to `bag-supreme-mesh-duffle`
  - 5/6-panel mesh-back caps and `슈프림X코스 포타프로 헤드폰` remain null

## Deferred

- TNF Supreme backpack still needs a later product-shape split for shoulder/waist/backpack variants. Wave 436 only restored prior backpack behavior and avoided accidental nulling.
- Generic Supreme shoulder can later be split by season/year/color if enough clean samples exist.
- Generic `bag-supreme-mesh-bag` remains intentionally review-gated until exact mesh bag model signals are clearer.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
