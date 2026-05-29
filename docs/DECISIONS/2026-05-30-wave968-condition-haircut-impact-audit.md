# Wave 968 — Condition Haircut Impact Audit

Date: 2026-05-30 KST

## Context

Wave 966 introduced soft-condition profit haircuts, and Wave 967 exposed the haircut in detail UI. Before doing any destructive replay, we need a repeatable dry-run audit to see how many ready/reserved rows are affected.

## Decision

Add `scripts/report-condition-profit-haircut-impact.ts`.

The script is report-only:

- reads ready/reserved pool rows
- joins listing price/market price, raw source, and parsed condition chips
- recomputes old vs adjusted profit using the same condition haircut policy
- writes latest JSON/Markdown reports under `reports/`

It does not mutate Supabase.

## Run Result

Command:

```bash
npx tsx scripts/report-condition-profit-haircut-impact.ts --limit=10000 --statuses=ready,reserved
```

Result:

- audited affected rows: 68
- affected rate: 1.6%
- rows that would lose positive profit after haircut: 23
- drop-to-zero rate: 0.5%
- total max-profit drop across affected rows: 680,077 KRW
- average max-profit drop among affected rows: 10,001 KRW

Most affected rows were Daangn:

- Daangn: 66
- Joongna: 1
- Bunjang: 1

Top soft chips:

- `condition:earphone_missing_parts`: 43
- `condition:low_battery_health`: 12
- `condition:cosmetic_wear`: 12
- `condition:earphone_hygiene_warning`: 7

## Interpretation

The policy is not broadly destructive. It mainly affects Daangn rows with missing earphone parts and low-battery devices, which matches the intended risk surface.

The 23 rows that drop to zero should naturally fall out as workers refresh/rebuild pool rows. No manual DB replay was run in this wave.

## Deferred

- Decide whether to run a targeted non-destructive refresh/rebuild for affected ready rows after observing production worker propagation.
- Exact soft-chip market medians remain deferred.
