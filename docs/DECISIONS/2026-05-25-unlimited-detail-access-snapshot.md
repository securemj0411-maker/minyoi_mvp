# 2026-05-25 unlimited detail access snapshot

## Context
- Operator/beta accounts have unlimited detail access.
- The server did not consume free-detail counters for unlimited accounts, which is correct.
- The client only saw `freeUsed=0/freeLimit=3`, so locked feed cards kept showing `첫 상세 무료 3회 남음`.

## Decision
- Add `unlimited: true` to detail access snapshots for operator/beta accounts.
- Return `freeUsed=freeLimit` for unlimited accounts so older/free-counter UI does not show remaining free opens.
- Client treats unlimited access as its own entitlement and shows `상세 무제한` instead of `첫 상세 무료`.

## Deferred
- No change to billing/credit policy.
- No change to how normal users consume the first three free detail opens before credit spending.
