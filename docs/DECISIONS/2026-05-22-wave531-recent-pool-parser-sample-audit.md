# 2026-05-22 Wave 531 — Recent Pool Parser Sample Audit

## Context

Operator comments and recent pool samples showed three recurring pollution patterns:

- Full-unit comparable samples included accessory-only rows, e.g. Dyson Airwrap accessories and DJI Osmo Pocket Type-C base.
- Exchange-only posts were still able to carry product comparable keys in old parsed rows.
- Some ready rows still held stale fashion comparable keys from older parser versions, such as generic `shoe|broad` or generic bag lanes.

## Decisions

1. Add generic option-parser blocks for exchange-only titles.
   - `exchange_only` is now a flawed/pool-block/comparable-exclude condition note.
   - The detector targets directional/exclusive exchange wording like `[교환]`, `-> ... 교환`, and `교환해요`.
   - Sale disclaimers such as `교환/환불 불가` remain allowed.

2. Add generic option-parser blocks for explicit accessory/parts-only full-unit pollution.
   - `parts_only` now catches `부속품 팝니다`, `부속품만`, `악세사리 단품`, and title-ending accessory nouns such as `Type-C 베이스`.
   - `본체 + 부속품` remains allowed; plain included accessory wording is not enough to block.

3. Make pool-block condition notes force `needsReview=true`.
   - This keeps bad rows out of comparable sample fetches before UI-level note filtering.

4. Treat `home_appliance` and `drone` option-parser rows as stale when parser version is older than `option-parser-v55`.
   - This is intentionally narrower than bumping every option-parser category.

5. Performed a narrow production DB cleanup for recent/commented pollution rows.
   - Upserted current parsed rows for commented accessory/exchange/stale-key samples.
   - Invalidated and marked score-dirty stale ready rows whose pool key/condition no longer matched current parser replay.
   - Final verification: latest 220 ready rows had 0 current-parser key/condition/needsReview drift.

## Verification

- `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/core-rules.test.ts`
- Earlier full parser suite pass before the final exchange-pattern and parts-only narrowing:
  - `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts tests/core-rules.test.ts`
- Production read-only replay check after cleanup:
  - `readyChecked=220`
  - `issueCount=0`

## Deferred

- Size-band-aware velocity grouping remains deferred. Size can matter for liquidity/turnover even when price is grouped by model.
- A broader non-fashion stale parser sweep can be done later; this wave only cleaned recent ready/commented pollution rows.
