# Wave 817 CDG Nike Exact Split

Date: 2026-05-25

## Context
- After shoe/clothing safety cleanup, CDG Nike remained a risky broad shoe lane.
- Historical parsed rows under `shoe|cdg_nike_collab|sneaker|a_grade` mixed many different market axes: Dunk, Terminator, Pegasus, Presto Foot Tent, Tennis Classic, Sense 96, Foamposite, Talaria, and Heel Premier.
- User goal is not to simply roll back bad rows, but to make future raw inflow land in safer exact SKUs when model evidence is explicit.

## Findings
- `cdg_nike_collab` broad was a real high-spread bucket, not a single-price comparable group.
- Exact model wording was usually explicit in titles, so this is a deterministic split candidate.
- Three rows stayed intentionally unresolved:
  - `나이키 cdg`
  - `나이키 꼼데가르송 새상품 운동화 280`
  - `(245) 꼼데가르송 X 나이키 클래식 SP2 화이트`
- Those rows remain broad/blocked until a repeatable exact model axis is added.

## Decisions / Changes
- Added exact Nike × CDG shoe SKUs:
  - `shoe-cdg-nike-dunk-low-collab`
  - `shoe-cdg-nike-terminator-high-collab`
  - `shoe-cdg-nike-pegasus-collab`
  - `shoe-cdg-nike-presto-tent-collab`
  - `shoe-cdg-nike-tennis-classic-collab`
  - `shoe-cdg-nike-sense96-collab`
  - `shoe-cdg-nike-foamposite-collab`
  - `shoe-cdg-nike-talaria-collab`
  - `shoe-cdg-nike-heel-premier-collab`
- Marked those exact lane keys as `ready`.
- Kept broad `cdg_nike_collab` blocked/internal-only.
- Treated `cdg_nike_collab` as a fashion broad promotion target so explicit model lanes beat the broad candidate instead of becoming ambiguous/null.

## DB Mutations Applied
- Reclassified historical broad CDG Nike parsed rows:
  - scanned parsed rows: 17
  - candidate rows: 14
  - reclassify rows: 14
  - reject rows: 0
  - reason: `wave817_cdg_nike_exact_split`
- Reclassified rows included Dunk Low, Terminator High, Pegasus, Presto Foot Tent, Tennis Classic, Sense 96, Foamposite, Talaria, and Heel Premier.
- Market stats refresh after apply:
  - `timedOut=false`
  - `scored=672`
  - `poolUpserted=727`
  - `upserted=156`
  - `market_invalidation_claimed_shoe_keys=12`

## Verification
- Regression:
  - `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 22/22 passed.
- Manual exact-match check:
  - All 9 explicit Nike × CDG model examples now resolve to exact SKUs.
  - `나이키 cdg` still resolves to broad `shoe-cdg-nike-collab`, which is blocked by lane readiness.
- All-category current reparse cleanup dry-run:
  - `scannedPoolRows=521`
  - `candidateRows=0`
  - `invalidatePoolRows=0`
  - `reclassifyRows=0`
  - `rejectRows=0`
- Shoe SKU safety:
  - `readySku=72`
  - `safe_public=65`
  - `probably_safe=7`
  - `fix_now=0`

## Deferred / Follow-Up
- Do not release vague `cdg_nike_collab` broad.
- Add Classic SP2 only if repeatable raw inflow gives enough exact evidence and sample support.
- Some new exact lanes may still wait on market median/sample support before appearing in public pool; `ready` is a gate permission, not a guarantee that sampleless rows become public.
- Continue the same deep-sweep pattern on remaining shoe and clothing watch/internal-only broad buckets.
