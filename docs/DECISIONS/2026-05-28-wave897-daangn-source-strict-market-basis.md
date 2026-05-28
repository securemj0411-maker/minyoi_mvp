# Wave 897 - Daangn Source-Strict Market Basis

Date: 2026-05-28

## Decision

The user caught a trust issue on a Daangn detail page: the listing source was Daangn, but the detail page showed "통합 중고 시세" and comparison evidence mixed Daangn, Bunjang, and Joongna rows.

Current policy before this wave:

- If same-source market stats were available, use them.
- If same-source stats were missing or below threshold, silently fall back to mixed market stats.

That fallback is not acceptable for Daangn because Daangn is a local execution channel. A user deciding whether to buy a nearby Daangn item needs Daangn-market evidence, not an integrated national marketplace reference presented as the main basis.

## Changes

- `marketBasisForCandidate` now treats Daangn as source-strict.
- If Daangn-specific stats are unavailable, it returns a Daangn-labelled basis with no median instead of silently using mixed stats.
- Daangn detail comparison evidence now filters to Daangn rows whenever the basis source is Daangn, including the source-insufficient case.
- `market-source` API response stats now mirror the selected display basis instead of returning mixed daily stats behind a source-specific label.
- Score-stage pool calculation now refuses mixed fallback for Daangn rows. Daangn rows need source-specific market stats to calculate trusted profit.

## Deferred

- Bunjang and Joongna remain allowed to fall back to mixed stats for now. If product policy changes, the strict-source set can be expanded.
- Existing ready Daangn rows calculated before this deployment may remain until score/market invalidation refreshes them.
