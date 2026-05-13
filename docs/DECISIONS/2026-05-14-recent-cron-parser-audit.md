# 2026-05-14 Recent Cron Parser Audit

## Context

After the QStash cron catch-up and Wave 57 query expansion, we audited recent marketplace rows to verify whether newly collected tech/home/IT listings are being parsed correctly and to find deterministic parser gaps before public promotion.

## Read-Only Audit

Generated:

- `reports/recent-cron-parser-audit-latest.md`
- `reports/recent-cron-parser-audit-latest.json`

Window: 8 hours.

Summary:

- raw recent rows: 1,641
- tech-signal rows: 1,449
- parsed rows: 348
- missing parsed rows: 1,293
- candidate-pool rows among recent: 26

Status groups:

- missing_parsed: 1,111
- stale_or_backfill_needed: 142
- v31_clean: 188
- classified_hold: 4
- v31_parser_gap_or_policy_review: 4

Interpretation:

- The largest blocker is not a current parser rule gap. Most newly collected rows have not reached parsed state yet.
- The current v31 parser still routes only 4 sampled rows to true parser/policy review: explicit storage/SSD/connector/chip data is missing, so silent inference remains forbidden.
- Two recent pool-risk rows are stale tablet rows where current v31 replay would mark bundle/accessory review. They need reparse/pool cleanup before public promotion.

## Deterministic Fixes

Applied code-only deterministic fixes:

1. MacBook M1 Pro generation axis
   - `m1_pro` now creates `m1pro_gen`, instead of `unknown_generation`.
   - Fixture added for `맥북 프로 m1 pro 16인치 16gb 512gb`.

2. MacBook missing-box wording
   - `맥북에어 박스는 없음` no longer gets classified as box-only accessory.
   - Box-only listings still remain non-normal.

3. Desktop exact Apple lanes
   - Added `desktop-imac-m1-24`.
   - Added `desktop-mac-studio-m4-max-512`.
   - Query cleanup replaces polluted `맥스튜디오` with `맥 스튜디오` and `Mac Studio`.

## Verification

Passed:

- `npx tsc --noEmit`
- `npm run test:core` → 139/139
- `npx eslint src/lib/catalog.ts src/lib/option-parser.ts src/lib/pipeline-config.ts src/lib/pipeline.ts scripts/report-recent-cron-parser-audit.ts tests/core-rules.test.ts --max-warnings=0`

## Deferred

- No DB write, candidate pool write, public promotion, DDL, or cron mutation in this wave.
- Recent stale tablet pool rows should be handled by a separate reparse/pool cleanup wave.
- Missing parsed backlog should be monitored through detail/parse drain rather than patched as parser logic.
