# Wave 959 — condition sweep coverage audit

## Context

User asked whether the recent condition deep sweeps were truly complete, how many rows were checked, and whether this was tens of thousands per category or only a few hundred.

## Honest answer

The work so far is not a full per-category exhaustive sweep over every historical row.

What was done:

- User-visible `candidate_pool.status in (ready,reserved)` was audited broadly across categories.
- Core tech categories were sampled at `parsed` scope, usually 3,000 rows per category.
- Some categories also had current pool cleanup/apply passes.
- Fashion was audited strongly at ready/reserved pool scope, but not exhaustively across all historical parsed clothing/shoe/bag rows.

## Current DB population snapshot

Exact counts checked on 2026-05-30 KST:

| category | parsed rows | ready/reserved pool rows |
|---|---:|---:|
| smartphone | 24,927 | 1,022 |
| tablet | 10,944 | 196 |
| smartwatch | 9,070 | 282 |
| laptop | 5,861 | 33 |
| earphone | 13,077 | 555 |
| shoe | 57,196 | 663 |
| clothing | 63,229 | 1,134 |
| bag | 15,123 | 3 |
| sport_golf | 8,130 | 67 |
| game_console | 6,089 | 21 |
| camera | 187 | 0 |
| speaker | 411 | 12 |
| monitor | 132 | 0 |
| desktop | 520 | 0 |
| home_appliance | 716 | 26 |
| drone | 1,218 | 40 |
| lego | 120 | 0 |

## Sweep coverage from logs

- Smartphone:
  - parsed sweep: 3,000 rows
  - pool sweep: 818 rows in Wave 935; later pool audits reran.
- Earphone:
  - parsed sweep: 3,000 rows in Wave 936.
  - pool sweep: about 500 rows in Wave 947, cleaned to candidateRows 0.
  - recent raw sweep: 4,999 rows over 7 days; this still had report false positives and was not treated as final exhaustive cleanup.
- Tablet:
  - parsed sweep: 3,000 rows.
  - pool sweep later showed 0 exposed candidates in Wave 954.
- Smartwatch:
  - parsed sweep: 3,000 rows.
  - pool sweep later showed 0 exposed candidates in Wave 954.
- Laptop:
  - parsed sweep: 3,000 rows.
  - pool sweep later showed 0 exposed candidates / very small exposed pool.
- Fashion (`shoe`, `clothing`, `bag`):
  - ready/reserved pool sweep: 1,718 to 1,762 rows depending on run.
  - suspiciousHighGradeRows: 0.
  - learnedWithoutCurrentNoteRows: 0.
  - Historical parsed population is much larger, so this is not a full historical sweep.
- All ready/reserved condition chip audit:
  - poolRows: 4,045.
  - hardSplitRows: 13 before repair-signal policy cleanup, 7 after.
  - remaining 7 were verified as stale stored parser residue under current parser.

## Risk assessment

- Current visible pool risk is much lower than before because the exposed pool has been repeatedly checked and pool gates now read both `condition_notes` column and `parsed_json.condition_notes`.
- Historical parsed data still has coverage risk, especially `clothing` and `shoe`, because those categories have tens of thousands of rows and were not exhaustively swept at parsed scope.
- Regex-only deep sweep cannot prove zero holes. It can find repeated language patterns, but ambiguity/negation/image-reference cases still need an AI/ambiguity audit queue.

## Next decision

If we want to call condition parsing "properly swept", the next wave should be a coverage matrix rather than another one-off regex patch:

1. Run stratified parsed sweeps by category and source.
2. For huge categories (`shoe`, `clothing`, `bag`), sample at least 10,000 each or chunk through all historical rows in batches.
3. Track false negative candidates, false positives, and stale DB rows separately.
4. Feed ambiguous rows to an AI second-pass queue instead of widening regex blindly.
5. Keep ready/reserved exposed pool cleanup as the operational safety gate.

