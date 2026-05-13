# Wave54 Candidate Pool Promotion

- generatedAt: 2026-05-13T22:35:00Z
- decision: owner requested aggressive MVP exposure for deterministic/high-confidence Wave54 rows.
- action: set `pool_eligible=true` and `score_dirty=true` for the 16 Wave54 internal acquisition rows.
- implementation: `scripts/apply-wave54-candidate-pool-promotion.ts`
- direct candidate_pool insert: 0
- public category readiness change: 0
- parser/catalog/runtime policy change: 0

## Result

- promotion dry-run passed for all 16 rows.
- apply passed: 16/16 rows now have `pool_eligible=true`.
- manual tick processed score stage: scored 51, poolUpserted 3, poolSkipped 48.
- target Wave54 rows in candidate_pool after scoring: 1/16.
- reason: most target rows are correctly parsed but do not clear existing money-candidate pool policy, mainly `profit_not_positive`, `price_gte_market`, low expected profit, or blocking score flags such as `condition_review` / `ai_second_opinion_hold`.

## Interpretation

Wave54 proved that internal rows can be promoted into the normal scoring path. It also proved that "parser-ready/public-pilot" and "money-making candidate_pool-ready" are not the same gate.

For the current MVP, the existing candidate_pool policy remains profit-first:

- expected average profit below 20,000 KRW stays out of candidate_pool.
- price at or above market median stays out.
- review/condition/AI-hold flags stay out.

This is correct if the MVP promise is "money-making resale candidates." If the MVP also wants "verified product watchlist" exposure, add a separate watchlist/low-margin surface instead of weakening the candidate_pool policy.

## Post Checks

- pack-open-quality: 42/48 reveal, activeReadyPool 353, errors 0.
- db-hotpaths 1h: 37 runs / 2 failed, pg_stat ok, top suspect detail_worker 210s.
- current-state-board: still `needs_operational_attention_before_runtime_patch`; no Wave54-induced candidate_pool/public regression found.

## Next

1. Keep Wave54 16 flags enabled and let normal cron observe them.
2. Do not lower profit policy inside candidate_pool just to make the count look better.
3. For immediate MVP user exposure, prioritize finding/promoting rows that are both deterministic and profitable.
4. For broader product coverage, add a separate low-margin/watchlist concept if desired.
