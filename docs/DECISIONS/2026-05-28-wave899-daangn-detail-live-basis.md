# Wave 899 - Daangn Detail Live Basis

Date: 2026-05-28

## Decision

Daangn detail screens must not show a source-strict comparison list while leaving the actual market basis as `null`.

The user reported a Daangn AirPods listing where the detail page showed three Daangn comparison listings, but the easy-mode header still said market price was pending and net profit was `0`. This happened because the comparison list endpoint can find live same-source examples before `mvp_market_price_daily_per_source` has caught up.

## Changes

- Added a live same-source market basis fallback for strict-source markets.
- For Daangn, if the daily per-source row is missing but at least three safe same-source comparison listings exist, detail analysis now derives a median from those live rows.
- The live fallback excludes the target listing, risk-hit rows, excluded-condition rows, non-normal listing rows, and source-mismatched rows.
- `/api/packs/pool/analysis`, `/api/packs/reveals/detail`, `/api/listings/[pid]/market-source`, `/api/packs/me`, and detail-access recomputation now use the same fallback.
- Daangn profit display now uses source-aware cost math in the easy/detail modal:
  - Daangn resale fee = `0`
  - Daangn resale shipping = `0`
  - Safety buffer remains
- Detail access now recomputes source-aware profit before applying the stale `expected_profit_max <= 0` guard.

## Deferred

- Daangn golf model specificity still needs a separate parser/catalog wave. The current fix makes the source/cost basis coherent; it does not solve every model-option precision issue such as different wedge generations or loft degrees.
- Existing DB candidate/reveal profit snapshots may remain stale until workers refresh, but user-facing detail and `/me` now recompute at request time when enough live source examples exist.
