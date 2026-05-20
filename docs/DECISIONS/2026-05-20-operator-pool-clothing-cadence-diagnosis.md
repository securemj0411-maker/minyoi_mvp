# Operator Pool Clothing Cadence Diagnosis

- generated_at: 2026-05-20
- scope: read-only diagnosis of current operator/admin ready pool composition
- mutation: none

## Finding

Current `mvp_candidate_pool` active ready pool has a real clothing concentration:

| metric | value |
| --- | ---: |
| active ready/reserved pool | 573 |
| clothing ready rows | 230 |
| clothing share | 40.1% |
| next categories | earphone 85, smartwatch 60, smartphone 52, tablet 48, shoe 40, bag 28 |

The concentration is partly market/cadence-backed. In the last 24h raw window:

| metric | clothing |
| --- | ---: |
| raw rows with clothing sku prefix | 4,750 |
| active + normal + detail done | 3,434 |
| pool_eligible=true rows | 1,150 |

The search registry also strongly represents fashion:

| category | enabled search queries | effective 5m queries |
| --- | ---: | ---: |
| shoe | 625 | 67 |
| clothing | 332 | 70 |
| bag | 113 | 10 |

## Decision

Do not treat the clothing-heavy pool as purely market cadence. The current state is mixed:

1. `clothing` is intentionally public-ready after Wave 215/216/221 work, so clothing rows can enter pool by design.
2. The live market does produce high clothing volume and high nominal spread rows.
3. There is also an operator-pool hygiene issue: active clothing ready rows include `raw.pool_eligible=false` and detail-pending rows.

Measured current mismatch:

| check | clothing ready rows |
| --- | ---: |
| raw.pool_eligible=true | 67 |
| raw.pool_eligible=false | 163 |
| raw detail/state/type = active/done/normal | 117 |
| raw detail/state/type = active/pending/normal | 113 |

Therefore the operator pool is not just reflecting market cadence. It also contains historical or stale candidate_pool rows that are no longer aligned with raw eligibility/detail readiness.

## Deferred

- No cleanup/invalidation was applied.
- No cadence, parser, catalog, schema, or pool-builder code was changed.
- No search registry override was changed.

## Next Work

1. Add or run a read-only audit for `candidate_pool.status=ready` joined to raw eligibility/detail state.
2. Decide whether to invalidate ready rows where `raw.pool_eligible=false`, `detail_status!='done'`, `listing_state!='active'`, or `listing_type!='normal'`.
3. If cleanup is approved, apply it as a bounded invalidation wave and record before/after category distribution.
4. Separately consider a category cap/diversity rule for admin/operator pool display if the product goal is balanced review, not pure expected-profit ordering.
