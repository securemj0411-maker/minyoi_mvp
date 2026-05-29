# Wave 974 — Condition Chip Residue Watch

Date: 2026-05-30 KST

## Context

After adding condition-haircut stale-pool monitoring, a broader condition-chip audit found ready/reserved rows that still had hard pool-block condition notes.

The new pool builder blocks these notes, but old ready rows can remain if they were promoted before the policy tightened.

Another issue appeared during cleanup: a single REST call with a large `limit` may only return the first 1,000 rows, so incident-watch checks must page through the pool instead of trusting one large request.

## Decision

Add a second incident-watch guard:

- incident key: `pool_block_note_residue`
- scans ready/reserved pool rows with offset pagination
- reads `condition_notes` and `parsed_json.condition_notes`
- alerts if any `POOL_BLOCK_NOTES` residue remains in ready/reserved

Also change the condition-haircut stale-pool check to use the same paginated pool fetch.

## Cleanup Applied

Invalidated current pool-block residue rows:

- reason: `condition_note_pool_block_residue`
- rows: 7
- pids: `9001164306090`, `9001986741219`, `9003411867793`, `9001823211950`, `9001610253167`, `9002039034960`, `9001662494964`

After that, one fresh condition-haircut drop-to-zero row surfaced and was invalidated:

- reason: `condition_haircut_profit_not_positive`
- pid: `9002547439732`

## Verification

Final audits:

- condition chip policy audit
  - pool rows scanned: 4,246
  - hard split rows: 0
  - exact hard-chip sparse rows: 0
- condition profit haircut audit
  - affected rows: 27
  - drop-to-zero rows: 0
  - stale pool profit rows: 0
  - total pool profit overstatement: 0 KRW
- tech-device condition evidence sweep
  - pool rows: 1,616
  - hard candidate rows: 0
  - new evidence-only hard rows: 0

## UI Fix

Fixed condition chip display labels for normalized shoe extra chips:

- `extra:extra_laces` → `여분끈`
- `extra:insole_changed` → `깔창 교체`

The stale pre-normalization keys `shoe:extra_laces` / `shoe:insole_changed` are intentionally not displayed.

## Deferred

- Do not enable exact chip-set comparison globally yet.
- Current density supports hard-block residue cleanup and hard-chip contamination exclusion, but soft/premium chips should remain display/penalty evidence until per-SKU density is proven.
