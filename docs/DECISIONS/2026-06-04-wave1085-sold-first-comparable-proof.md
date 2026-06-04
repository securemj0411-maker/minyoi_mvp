# 2026-06-04 Wave 1085 - Sold First Comparable Proof

## Decision
- Visible comparable listings are price proof, so sold/terminal rows must outrank active asking-price rows.
- Showing active rows first while velocity says recent sold rows exist makes the market basis look unsupported.

## Implemented
- Expanded comparable-key candidate lookup to inspect more parsed rows before raw filtering.
- API proof rows now sort by sold/terminal status first, then price, then recency.
- Detail modal and market-source debug sorting now preserve sold-first order.

## Deferred
- If a comparable key has more than the inspected candidate cap, a future SQL RPC should join parsed/raw server-side and order sold rows before applying limits.
