# Wave 505 — Candidate Pool Parser Freshness Gate

Date: 2026-05-21

## Context

Shoe/bag ready pool QA had already been tightened in Wave 501, but a structural gap remained: old parsed rows could still be evaluated by `buildCandidatePoolRows` if they reached score-stage input before being reparsed or invalidated.

This made stale comparable keys such as older `shoe|broad|*`, `shoe|football|*`, or generic bag buckets feel like whack-a-mole because cleanup depended too much on downstream sweeps.

## Decision

Add a final parser freshness gate at candidate-pool build time.

- `buildCandidatePoolRows` now accepts `latestParserVersionByCategory`.
- If a parsed row's `parser_version` does not match the latest version for its category, it is blocked before ready entry.
- The invalidation reason is category-specific: `stale_parser_version_${category}`.
- `scoreStage` passes `LATEST_PARSER_VERSION_BY_CATEGORY` into the pool builder.

This is intended to make parser bumps convergent: stale parser artifacts can be marked dirty and reparsed, but they cannot re-enter ready pool while stale.

Also added a score-dirty cleanup for rows that score-stage will never process:

- `scoreStage` only processes normal listings: `listing_type = normal` or `listing_type_override = normal`.
- Rows with `score_dirty=true` but non-normal types such as `callout`, `unknown`, `damaged`, `parts`, or `commercial` were accumulating as dead backlog.
- `scoreStage` now clears `score_dirty` for these non-scorable rows before loading scorable work.
- This keeps dirty backlog metrics meaningful: remaining dirty rows should indicate actual pending scoring work, not rows that are intentionally excluded from scoring.

Then tightened fashion pool precision one more step:

- `shoe` / `bag` / `clothing` rows with broad comparable tokens ending in `_broad` are held with `fashion_broad_sku_review`.
- `shoe` / `bag` / `clothing` rows with `unknown_condition` are held with `fashion_unknown_condition_review`.
- This deliberately reduces ready pool size so the first exposed fashion items are exact model + known condition samples, not broad buckets.

Runtime safety note:

- The non-scorable dirty cleanup query was narrowed to `listing_type != normal` and `listing_type_override is null`.
- Cleanup is non-fatal; if Supabase REST times out, score-stage continues instead of failing the whole scoring pass.

## Verification

Ran:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave498-high-profit-anomaly-guard.test.ts tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts
```

Result: 367/367 tests passed after adding the broad/unknown-condition review gate.

Live DB check after cleanup:

- `dirtyShoe`: 0
- `dirtyBag`: 0
- ready/reserved shoe+bag: 9
- ready/reserved fashion broad keys: 0
- ready/reserved fashion unknown-condition keys: 0
- stale parsed ready rows: 0
- old problem buckets: `shoe|broad|*`, `shoe|football|*`, old Novablast, old Supreme backpack: all 0

## Wave 506 Follow-up — Ready Shoe Axis Tightening

After the freshness gate landed, the remaining ready shoe rows still exposed older v15 comparable axes. Those rows were not broad in the old sense, but they still grouped distinct product families too coarsely:

- Salomon `ACS+` was grouped with `ACS Pro`.
- Adidas football was grouped as one family instead of Copa / Predator / F50 / X Crazyfast / Nemeziz / Messi.
- Nike x Sacai was grouped as one family instead of Blazer / Vaporwaffle / LDWaffle / Cortez.
- Hoka Kaha GTX was treated as a sneaker instead of a boot.

Decision:

- Bump shoe parser to `wave92-shoe-v16`.
- Split the three remaining broad-ish model axes in `refineShoeModelFromText`.
- Add catalog default product type `boot` for `shoe-hoka-kaha-gtx`.
- Keep the candidate-pool stance conservative: if a newly split exact comparable key has no trusted market median, invalidate with `sku_median_unavailable` instead of falling back to the old mixed bucket.
- Add external collab review gating for fashion rows unless the SKU itself is a collab lane.

False-positive note:

- The first external-collab regex was too broad and treated tokens such as `GTX`, `XL`, `2xl`, `xs`, and `sl` as `x` collaborations.
- Restored those rows and narrowed the regex to spaced `x` / `×`, Korean `브랜드 x 브랜드`, or explicit `collab/콜라보/협업` wording.

Verification after Wave 506:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave498-high-profit-anomaly-guard.test.ts tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts
```

Result: 370/370 tests passed after the ready-pool audit additions.

Live DB after marking current ready/reserved fashion stale rows dirty and running `scoreStage`:

- ready/reserved fashion: 41 -> 28
- ready/reserved shoe+bag: 6 -> 1
- stale ready/reserved fashion parser rows: 0
- ready/reserved fashion broad keys: 0
- ready/reserved unknown-condition keys: 0
- remaining ready shoe/bag: `402268835` New Balance 2002R, `shoe|2002r|sneaker|265|a_grade`, parser `wave92-shoe-v16`

Rows removed from ready were removed for conservative reasons, not parser failure:

- Salomon ACS+ -> `shoe|acs_plus|sneaker|260|b_grade`, invalidated because no exact-key market median yet.
- Adidas CopaPure2+ FG -> `shoe|adidas_football_copa|football_fg|270|a_grade`, invalidated because no exact-key market median yet.
- Nike Sacai Blazer -> `shoe|nike_sakai_blazer|sneaker|265|a_grade`, invalidated because no exact-key market median yet.
- Hoka Kaha GTX -> `shoe|kaha_gtx|boot|250|a_grade`, invalidated because no exact-key market median yet.
- Vans x SCI-FI and Vans x Pendleton stayed invalidated with `fashion_external_collab_review`.

## Wave 506 Ready-Pool Audit Addendum

Audited the remaining ready/reserved fashion rows after the v16/v17 cleanup.

Found and removed three exact-looking but semantically wrong rows:

- `152706206` — Levi's LVC row with `RRL` tag bait had entered `clothing-polo-rrl-pants`.
- `309789801` — Ralph Lauren Rugby chino row with `RRL` tag bait had entered `clothing-polo-rrl-pants`.
- `392653145` — Patagonia Baby Torrentshell had entered adult `clothing-patagonia-shell`.

Decision:

- Add `리바이스` / `Levi's` / `LVC` / `Rugby` bait blocks to the RRL shirt and pants lanes.
- Add `베이비` / `baby` to Patagonia shell kids blocks.
- Mark the three live rows `pool_eligible=false` and invalidate their current candidate-pool entries with `catalog_false_positive_bait_review`.
- Also invalidate the last stale ready candidate-pool residue (`409226452`) with `stale_parser_version_clothing`.

Final live DB check:

- ready/reserved fashion: 24
- ready/reserved shoe+bag: 1
- stale ready/reserved fashion parser rows: 0
- ready/reserved fashion broad keys: 0
- ready/reserved unknown-condition keys: 0
- ready/reserved `needs_review=true`: 0

## Wave 507 Addendum — Pool Residue Cleanup + Final Condition Key Sync

Further ready-pool audit found that many candidate-pool rows were still `ready` even though their source raw rows already had `pool_eligible=false`. This was not a parser miss; it was stale pool state.

Decision:

- Add `invalidatePoolIneligibleResidues` at the start of `scoreStage`.
- It scans ready/reserved candidate-pool rows and invalidates rows whose raw listing is `pool_eligible=false`.
- Runtime result on first pass: 266 ready/reserved residues invalidated with `pool_eligible_false_residue`.

The final remaining ready/reserved fashion rows dropped to four. Two were held:

- `7000271091539` RRL denim had explicit `데미지` and `보강 필요`, but the clothing parser was still treating it like `a_grade` in the comparable key.
- `7001540961122` Polo Oxford had a very low seller rating (`2.56`, two reviews), but seller trust only influenced fake-floor checks, not normal pool entry.

Decision:

- Clothing condition parser now detects structural damage language: `데미지`, `구멍`, `찢어짐`, `해짐`, `보강 필요`, `수선 필요`.
- Low explicit seller rating now blocks pool entry with `seller_rating_below_3_5_review`; missing rating still does not block by itself.
- Bump clothing parser to `wave216-clothing-v20`.
- After metadata/fashion worst-of condition resolution, the final `condition_class` rewrites the comparable-key condition token before key materialization. This prevents mismatches such as `condition_class=flawed` while `comparable_key` still ends in `a_grade`.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave498-high-profit-anomaly-guard.test.ts tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts
```

Result: 375/375 tests passed.

Live DB after targeted dirty re-score:

- RRL denim parsed as `wave216-clothing-v20`, `clothing|polo_rrl_denim|jeans|reject`, `condition_class=flawed`, notes `clothing_structural_damage`, `repair_or_defect_signal`.
- RRL denim and Polo Oxford were invalidated by `seller_rating_below_3_5_review`.
- ready/reserved shoe/bag/clothing pool now has 2 rows:
  - `374028090` TNF 1996 Retro Nuptse, `clothing|tnf_nuptse_1996|down_jacket|a_grade`
  - `402596714` Arc'teryx Gamma SL Hybrid, `clothing|arcteryx_gamma|jacket|a_grade`

## Wave 508 Addendum — Existing Pool State Must Follow Parser/AI Drift

Follow-up live audit found three more state-drift problems after the parser freshness gate:

- Existing `ready` pool rows could still carry stale parser versions because the freshness gate only applied while rebuilding a row.
- Accepted rows that had previously been invalidated did not always revive cleanly unless `status='ready'` and `invalidated_reason=null` were written explicitly.
- AI shadow-audit metadata could be stale or wrong for a candidate-pool row because audit presence was checked by `pid` only, and batched status persistence reused the first reason for a whole verdict chunk.

Decision:

- Add `invalidatePoolStaleParserResidues` at `scoreStage` start. It scans ready/reserved pool rows, compares their parsed `parser_version` to `LATEST_PARSER_VERSION_BY_CATEGORY`, invalidates stale residues, and marks the raw rows `score_dirty=true` for immediate reparse.
- Accepted candidate-pool entries now explicitly write `status='ready'`, clear `invalidated_reason`, and clear `reserved_until`.
- `invalidatePoolEntries` now also updates already-invalidated rows so a reprocessed row's latest skip reason replaces stale reasons.
- Shadow audit now checks current `content_hash`, not just `pid`, before treating a row as already audited.
- Shadow audit status persistence now writes per-pid reasons rather than one representative batch reason.

Live verification:

- `402596714` Arc'teryx Gamma was reprocessed and correctly stayed `invalidated` with `sku_median_unavailable`.
- TNF 1996 Retro Nuptse (`374028090`) was reparsed with `wave216-clothing-v20`, kept `ready`, and its stale AirPods audit reason was corrected from the current AI classification.
- The TNF market sample bucket was inspected: no vest/shorts/bag/Supreme/Purple Label contamination was found. Its current mint/normal market rows were force-recomputed after v20 sample reparse.

## Wave 509 Addendum — Accessory Title Blocks + Needs-Review Pool Invalidation

Final ready-pool audit found `404770938` (`더블알엘 rrl 핸드메이드 홀스프린트 리넨 타이`) in `clothing|polo_rrl_jacket_coat|jacket|a_grade`. Root cause: the title was an accessory, but description text included `자켓이랑도 잘 맞습니다`, which promoted the row into an RRL jacket lane.

Decision:

- Add title-only clothing accessory detection for tie/necktie/muffler/scarf/keyring/jewelry-style titles.
- When such a title is detected, do not let description or catalog default product type promote the row into a garment lane; set `clothing_accessory_title_block` and `needs_review=true`.
- Add RRL jacket-coat catalog `mustNotContain` terms for tie/scarf/muffler accessories.
- When `scoreStage` skips a row because `parsed.needs_review=true`, it now invalidates any existing pool row with `parser_needs_review`. Previously it only skipped scoring and could leave an older ready row behind.

Live verification:

- `404770938` was removed from ready and is now `invalidated` (`pool_eligible_false_residue`; the new parser path would also mark it needs-review).
- ready/reserved shoe/bag/clothing after cleanup: 4 rows.
  - `374028090` TNF 1996 Retro Nuptse — clean sample bucket, AI pass.
  - `408379149` Arc'teryx Atom LT Hoody — Atom jacket bucket, AI unavailable shadow status.
  - `398530843` Arc'teryx Atom LT Hoody — Atom jacket bucket, AI unavailable shadow status.
  - `397313242` Ralph Lauren Oxford shirt — Oxford shirt bucket, AI pass.
- Arc'teryx Atom sample audit: no Beta/Gamma/Alpha/Mantis/bag/pants/accessory contamination found.
- Polo Oxford sample audit: current ready row is a normal Oxford shirt; multi-item / low-seller samples exist in the wider bucket but were not ready after gates.

Verification:

```bash
npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave238-ai-l2-shadow-audit.test.ts tests/core-rules.test.ts
npx tsx --test tests/wave249-pool-builder-clamp-fix.test.ts tests/wave498-high-profit-anomaly-guard.test.ts tests/wave254-5-fashion-condition.test.ts
```

Result: 320/320 and 59/59 tests passed.

## Deferred

- Size-based turnover grouping is still a later wave; current comparable-key tightening keeps size in sample keys where parser/catalog already models it, but sell-through math may need separate size bands later.

## Wave 510 Addendum — AI Shadow Audit Becomes a Fashion Pool Safety Gate

After Wave 509, the only remaining non-pass fashion ready rows were two Arc'teryx Atom listings whose `ai_audit_status` was `skipped_unavailable`. That is still too loose for a conservative fashion pool: if AI verification did not complete, the row should not stay visible as ready.

Decision:

- Keep `runShadowAudit` itself non-blocking; it only writes `ai_audit_status`.
- Add `invalidatePoolAiAuditResidues` at the start of `scoreStage`.
- For fashion categories (`clothing`, `shoe`, `bag`), invalidate ready/reserved rows with `ai_audit_status in ('hold', 'reject', 'skipped_unavailable')`.
- Reasons are explicit:
  - `ai_audit_hold_review`
  - `ai_audit_reject_review`
  - `ai_audit_unavailable_review`
- Fix shadow-audit prioritization to use candidate-pool `category`, not `skuName`, when giving fashion rows first audit priority.
- Sync candidate-pool audit status from the current AI cache before shadow audit, using the same content hash and pass/hold/reject logic. This prevents an old `skipped_unavailable` status from overriding a fresh cached AI pass.
- Run the same AI audit residue cleanup again after shadow audit, so a row cannot be revived and end the same tick as ready with `hold`, `reject`, or `skipped_unavailable`.

Live verification:

- A short score tick timed out later while loading raw rows from Supabase, but the startup cleanup completed first.
- `398530843` and `408379149` were invalidated with `ai_audit_unavailable_review`.
- ready/reserved shoe/bag/clothing pool now has 2 rows, both AI-pass:
  - `374028090` TNF 1996 Retro Nuptse, `clothing|tnf_nuptse_1996|down_jacket|a_grade`
  - `397313242` Ralph Lauren Oxford shirt, `clothing|polo_oxford_shirt|shirt|b_grade`

Verification:

```bash
npx tsx --test tests/wave238-ai-l2-shadow-audit.test.ts tests/core-rules.test.ts tests/wave254-6-product-type-priority.test.ts
```

Result: 320/320 tests passed.

Deferred:

- Production with `OPENAI_API_KEY` can revive true Arc'teryx Atom rows only after a fresh AI pass and normal score rebuild. Until then, fashion precision wins over coverage.

## Wave 511 Addendum — Stale Invalidated Fashion Rows Re-enter Parser Cleanup

Follow-up shoe audit found `405056706` (Adidas Gazelle) stuck as an invalidated candidate-pool row with an old shoe parser key. The raw row was still eligible, but `score_dirty=false`, so it could not naturally re-enter the v16 parser cleanup.

Decision:

- Add maintenance logic at `scoreStage` start to mark stale invalidated fashion rows dirty again when the raw row is still active, normal, detail-ready, SKU-bound, and not `pool_eligible=false`.
- This applies regardless of the invalidation reason, because a stale-parser row can later be overwritten by reasons such as `negative_resell_gap` or `sku_median_unavailable`.
- Cap the maintenance feed to 250 rows per tick so old invalidated cleanup does not starve fresh scoring work.
- When `scoreStage` invalidates a row from `buildCandidatePoolRows`, refresh candidate-pool `category`, `comparable_key`, and `condition_class` from the current parsed row. This keeps invalidated rows useful for debugging and future sweeps.

Live verification:

- Ran two larger score passes over the stale invalidated backlog.
- `405056706` reparsed from `wave92-shoe-v11` to `wave92-shoe-v16`.
- Its parsed key is now `shoe|adidas_gazelle_og_broad|sneaker|275|a_grade`; it remains invalidated because `sku_median_unavailable`, not because of stale parser.
- Backfilled 452 existing invalidated fashion candidate-pool rows so their metadata matches current parsed rows.
- Current ready/reserved shoe/bag/clothing pool has 4 rows, all `ai_audit_status='pass'`; shoe rows remain out of ready unless AI passes and market stats support them.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave254-6-product-type-priority.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
```

Result: 331/331 tests passed.

## Wave 512 Addendum — Fashion Ready Pool Requires Explicit AI Pass

Follow-up live audit found the fashion ready/reserved pool could still contain rows with
`ai_audit_status=null`. The existing residue cleanup only targeted explicit non-pass values
(`hold`, `reject`, `skipped_unavailable`), so missing audit status was not treated as unsafe.

Decision:

- Tighten `invalidatePoolAiAuditResidues` to scan all ready/reserved clothing, shoe, and bag rows.
- Keep only rows with `ai_audit_status='pass'`.
- Invalidate every other status, including missing/null audit status.
- Add a specific `ai_audit_missing_review` invalidation reason for missing status; keep explicit
  reasons for `hold`, `reject`, and `skipped_unavailable`.

Live verification:

- Ran a small `scoreStage` after the patch.
- Startup cleanup invalidated stale/ineligible pool residues first, and the live fashion ready/reserved
  pool is now pass-only.
- Current ready/reserved shoe/bag/clothing pool:
  - `407703779` — `clothing|polo_rrl_denim|jeans|b_grade`, `ai_audit_status='pass'`.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
```

Result: 121/121 tests passed.

## Wave 520 Addendum — Shoe Size-Agnostic Market Median Fallback

Shoe ready recovery was still too sparse because comparable keys include exact size.
For resale value, size can affect liquidity later, but price median is usually safer when
aggregated across nearby/common sizes than when exact-size samples are empty.

Decision:

- Keep exact shoe comparable keys as the primary source.
- Add a shoe-only auxiliary market key:
  - `shoe|model|product_type|size|grade`
  - `shoe|model|product_type|size_any|grade`
- Let score-stage use `size_any` only when the exact key has no trusted median.
- Preserve exact-size comparable keys in parsed rows and candidate_pool rows, so catalog identity
  remains narrow.
- Defer unusual-size velocity / rotation-rate bucketing to a later wave. We should record size
  liquidity separately rather than mixing it into price median now.

Live verification:

- Market worker recomputed 500 invalidation keys:
  - enriched 500 rows
  - scored 2,278 parsed rows
  - upserted 960 market rows
  - marked 2,501 raw rows `score_dirty`
- Healthy `size_any` rows now exist for lanes such as:
  - `shoe|dunk_low_black_white|sneaker|size_any|a_grade`: active sample 76, high confidence
  - `shoe|2976_chelsea|boot|size_any|b_grade`: active sample 25, high confidence
  - `shoe|bondi_9|sneaker|size_any|a_grade`: active sample 8 / sold sample 3, medium confidence

## Wave 521 Addendum — Fresh Raw `pool_eligible=false` Hard Gate

A Bunjang Hoka Bondi 9 row (`409208563`) reached ready even though the raw row had
`pool_eligible=false`. The startup residue cleanup removed it on the next score tick, but the same
tick needed a DB-fresh guard immediately before candidate-pool upsert.

Decision:

- Add `loadRawPoolIneligiblePids`.
- Reuse it in `invalidatePoolIneligibleResidues`.
- Before upserting candidate_pool entries, fetch the latest raw `pool_eligible=false` pids for the
  entries produced by `buildCandidatePoolRows`.
- Filter those entries out and invalidate them with `pool_eligible_false`.
- Run a post-upsert ineligible residue cleanup in the same score tick.

Live verification:

- The bad Hoka row is now:
  - status: `invalidated`
  - reason: `pool_eligible_false_residue`
- Follow-up score tick:
  - scored 245
  - pool accepted 9, skipped 236
  - skip leaders: `pool_eligible_false` 117, `seller_rating_below_3_5_review` 33,
    `sku_median_unavailable` 33, `negative_resell_gap` 29
- Current fashion ready/reserved sample contains only `pool_eligible=true` rows:
  - Asics Gel Nimbus 10.1, exact shoe key
  - RRL denim jeans, exact clothing key

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts tests/wave254-6-product-type-priority.test.ts
git diff --check -- src/lib/tick-pipeline.ts src/lib/pipeline.ts docs/DECISIONS/2026-05-21-wave505-candidate-pool-parser-freshness-gate.md
```

Result: 121/121 and 331/331 tests passed; diff check passed.

## Wave 522 Addendum — Low Seller Rating Applies Even With Zero Reviews

Live ready inspection showed a Joongna shoe row with `shop_review_rating=2.46` and
`shop_review_count=0`. The old seller gate ignored low ratings when review count was zero, which let
an untrusted seller remain ready. Distribution check showed Joongna count-zero rows have varied
ratings rather than a single default value, so the rating should be treated as a trust signal when
present.

Decision:

- Block any candidate with `shop_review_rating < 3.5` when rating is present.
- Keep missing/null seller ratings allowed by default.
- Add a startup residue cleanup for existing ready/reserved rows with low seller rating.

Live verification:

- Follow-up score tick invalidated 72 existing low-rating ready/reserved residues.
- The Asics Gel Nimbus ready row was removed.
- Current fashion ready/reserved rows:
  - `398868282` — Dr. Martens 2976 Chelsea, exact shoe key, seller 5.0 / 4
  - `407703779` — RRL denim jeans, exact clothing key, seller 4.7 / 3

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
git diff --check -- src/lib/tick-pipeline.ts src/lib/candidate-pool-builder.ts tests/core-rules.test.ts
```

Result: 122/122 tests passed; diff check passed.

## Wave 523 Addendum — Same-Tick Stale Parser Residue Cleanup After Pool Upsert

After another market/score cycle, two Dr. Martens 2976 rows re-entered ready while the persisted
`mvp_listing_parsed.parser_version` still showed `wave92-shoe-v11`. The next score tick's startup
cleanup would remove stale ready rows, but this still allowed a same-tick visibility window.

Decision:

- Run `invalidatePoolStaleParserResidues` again immediately after candidate-pool upsert and
  ineligible cleanup.
- Record `score_pool_stale_parser_post_residue_invalidated_rows`.
- Keep this as a same-tick safety net; exact parser reparse still happens via score dirty processing.

Live verification:

- Follow-up score tick invalidated 2 stale parser ready residues at startup.
- A later score tick reported `score_pool_stale_parser_post_residue_invalidated_rows=0`.
- Current ready/reserved fashion pool has no stale parser rows:
  - `398868282` — `shoe|2976_chelsea|boot|240|a_grade`, parser `wave92-shoe-v16`
  - `381770035` — `shoe|2976_chelsea|boot|250|a_grade`, parser `wave92-shoe-v16`
  - `407703779` — `clothing|polo_rrl_denim|jeans|b_grade`, parser `wave216-clothing-v20`

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
git diff --check -- src/lib/tick-pipeline.ts
```

Result: 122/122 tests passed; diff check passed.

## Wave 524 Addendum — Market/Score Recovery Loop Remains Conservative

Ran another market/score recovery cycle against the `sku_median_unavailable` backlog.

Live verification:

- Market worker:
  - claimed 500 invalidation keys
  - scored 2,832 parsed rows
  - upserted 945 market rows
  - marked 3,826 raw rows `score_dirty`
- Score worker:
  - scored 298 rows
  - accepted 8 into the builder, but post gates / audit left only 3 ready rows
  - top skip reasons remained conservative:
    - `pool_eligible_false`: 147
    - `seller_rating_below_3_5_review`: 78
    - `negative_resell_gap`: 28
    - `sku_median_unavailable`: 15
- Current ready rows were manually inspected and all have:
  - `pool_eligible=true`
  - latest parser versions
  - exact shoe/clothing comparable keys
  - no cross-category or broad backpack/wallet/apparel mixing observed

Deferred:

- Remaining `sku_median_unavailable` rows are mostly genuinely low-sample / low-confidence lanes
  (collabs, broad backpacks, football surfaces, rare sizes, unknown condition). Do not loosen these
  without a separate confidence policy.

## Wave 525 Addendum — Cool Down Unrecoverable `sku_median_unavailable` Market Refreshes

The recovery loop was repeatedly re-enqueueing `sku_median_unavailable` keys after market workers had
already recomputed them. The RPC intentionally reopens `done` invalidations as `pending`, which is
correct for real raw/detail changes but wasteful for rows whose market median is still unavailable
because the lane is genuinely low sample.

Decision:

- Add a 6 hour cooldown for `sku_median_unavailable` market refresh requests.
- Skip refresh enqueue when the market invalidation key is already:
  - `pending`
  - `processing`
  - locked
  - `done` with a recent `last_recomputed_at`
- Keep normal raw/detail/search invalidations unchanged.

Live verification:

- Before the cooldown, score ticks repeatedly reported around 100+ `score_sku_median_unavailable_market_invalidations`.
- After the cooldown, a follow-up score tick reported:
  - `score_sku_median_unavailable_market_invalidations=0`
  - `poolUpserted=0`
  - top skips remained conservative: `pool_eligible_false`, low seller rating, negative gap, median unavailable
- Current ready/reserved fashion pool remains 3 rows and all are still:
  - `pool_eligible=true`
  - latest parser versions
  - exact comparable keys

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
git diff --check -- src/lib/tick-pipeline.ts
```

Result: 122/122 tests passed; diff check passed.

## Wave 519 Addendum — Score Dirty Loader Hot-Path Split And Unscorable Backlog Drain

Follow-up live ticks showed the score stage no longer crashed after the fail-soft guard, but the
general dirty loader still hit Supabase statement timeouts when it asked PostgREST to combine
`score_dirty=true`, active/detail/SKU/listing-type filters, source filters, wide score columns, and
`last_seen_at` ordering in one query. A direct probe showed the `score_dirty` ordered index is fast,
while the combined scorable filter is the slow path.

Decision:

- Change the score loader to read from the fast `score_dirty=true order by last_seen_at desc` path,
  then apply active/detail/SKU/normal-listing eligibility in application code.
- Keep source feeds positive-only (`joongna` reserve and `bunjang` general) rather than
  `source != joongna`.
- Add `clearUnscorableScoreDirty` at score-stage startup so sold/inactive/no-SKU/pending dirty rows
  no longer permanently occupy the head of the dirty queue.
- Expand the pool-priority feed from ready/reserved to ready/reserved/invalidated so recovered
  `sku_median_unavailable` rows and stale-parser invalidated rows can be rescored immediately,
  instead of waiting behind old `last_seen_at` backlog.

Live verification:

- Before the patch, `source=eq.bunjang` scorable full-row fetches timed out at small limits.
- After the patch, a score tick completed without loader timeout:
  - `score_unscorable_dirty_cleared_rows=988`
  - `scored=12`
  - `poolUpserted=0`
  - skip reasons: `pool_eligible_false=6`, `sku_median_unavailable=5`,
    `fashion_unknown_condition_review=1`
- A second follow-up tick also completed without loader timeout:
  - `score_unscorable_dirty_cleared_rows=982`
  - `scored=18`
  - `poolUpserted=0`
  - skip reasons: `pool_eligible_false=14`, `sku_median_unavailable=4`
- Current clothing/shoe/bag ready/reserved pool remains empty.
- Current exact scorable dirty count is small (`dirtyScorableApprox=4`); the large remaining
  `score_dirty` total is mostly historical unscorable residue and will drain over later score ticks.

Deferred:

- Add a database index or RPC for the exact scorable dirty query if we need high-throughput draining
  instead of the current conservative incremental cleanup.
- Size/fit-sensitive rotation-rate bucketing remains a separate wave; current work only hardens
  candidate admission and comparable-key scoring correctness.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
git diff --check -- src/lib/tick-pipeline.ts src/lib/pipeline.ts
```

Result: 121/121 tests passed; diff check passed.

## Wave 517 Addendum — Recover From Current Market Daily, Not Only Listing Median

Follow-up sweep found 12 active/eligible fashion rows still invalidated with `sku_median_unavailable`
even though `mvp_market_price_daily` already had a trusted condition-fallback median. They remained
stuck because the recovery maintenance only checked `mvp_listings.sku_median > 0`, which can lag
behind market daily recomputation.

Decision:

- Extend `markRecoveredMarketInvalidatedPoolRowsDirty` to fetch parsed comparable keys and current
  market daily rows.
- Mark invalidated `sku_median_unavailable` rows dirty when either:
  - `mvp_listings.sku_median > 0`, or
  - `pickMarketStatByCondition` + `trustedMarketMedian` finds a usable current market median.
- Keep raw eligibility requirements unchanged: active, detail-ready, normal, SKU-bound, and not
  `pool_eligible=false`.

Live verification:

- A follow-up score tick marked 6 recovered-market invalidated rows dirty.
- The tick processed only recovery/pool-priority rows because the general dirty query timed out;
  no fashion rows entered ready.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
```

Result: 121/121 tests passed.

## Wave 518 Addendum — Score Loader Fails Soft On General Dirty Timeout

During a larger recovery score tick, Supabase REST timed out on the broad general dirty-row query
(`source=neq.joongna`). Previously that aborted the whole score stage, even though the pool-priority
and Joongna rows could still be processed.

Decision:

- Wrap Joongna and general dirty-row fetches in non-fatal try/catch blocks.
- If general dirty fetch times out, return already loaded pool-priority / Joongna rows instead of
  aborting the score stage.
- Keep the warning visible in logs so the broad query can still be optimized later.

Live verification:

- Re-ran scoreStage with a larger score limit.
- General fetch timed out again, but the stage completed.
- It processed 8 rows, marked 6 recovered-market invalidated rows dirty, and kept current
  shoe/bag/clothing ready/reserved pool empty.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
```

Result: 121/121 tests passed.

## Wave 514 Addendum — Recover Invalidated Rows After Market Median Appears

DB sweep showed several fashion rows still invalidated with `sku_median_unavailable` even after
`mvp_listings.sku_median` had become positive. This is safer than leaking bad rows, but it leaves
recoverable candidates stuck with an old invalidation reason after market stats catches up.

Decision:

- Add `markRecoveredMarketInvalidatedPoolRowsDirty` at score-stage startup.
- Target only clothing/shoe/bag rows currently invalidated with `sku_median_unavailable`.
- Mark a row dirty again only when:
  - raw row is active, detail-ready, normal, SKU-bound, and not `pool_eligible=false`
  - latest `mvp_listings.sku_median > 0`
- Cap the maintenance feed at 250 rows/tick.

Live verification:

- A follow-up score tick marked 4 recovered-market invalidated rows dirty.
- No clothing/shoe/bag rows entered ready because the remaining gates still held:
  - low seller rating
  - profit below pack band
  - still missing median
  - AI pass-only ready policy
- Current ready/reserved shoe/bag/clothing pool remains empty.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
git diff --check -- src/lib/tick-pipeline.ts docs/DECISIONS/2026-05-21-wave505-candidate-pool-parser-freshness-gate.md
```

Result: 121/121 tests passed; diff check passed.

## Wave 516 Addendum — Same-Tick `pool_eligible=false` Ready Re-entry Guard

After Wave 515, another ineligible shoe row briefly appeared in ready during the same score tick.
Root cause: `pool_eligible` was selected from raw rows and added to tick-pipeline's score row, but
`PipelineRow` did not declare the field and the candidate-pool upsert path still needed a final
runtime guard.

Decision:

- Add `poolEligible?: boolean | null` to `PipelineRow`.
- Keep passing `poolEligible` from `mvp_raw_listings.pool_eligible`.
- Add a pre-upsert guard in `scoreStage`:
  - filter candidate-pool entries whose original raw row has `pool_eligible=false`
  - invalidate those pids with `pool_eligible_false`
  - only upsert the guarded entries

Live verification:

- A follow-up score tick reported `pool_eligible_false: 8`.
- `poolUpserted` was 0 for those ineligible rows.
- Current ready/reserved shoe/bag/clothing pool is empty.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
```

Result: 121/121 tests passed.

## Wave 515 Addendum — Wire `pool_eligible` Into Runtime Pool Builder Input

Follow-up verification found a shoe row (`408983830`, Adidas Spezial) briefly re-entered ready even
though its raw row had `pool_eligible=false`. The startup residue cleanup would remove it on the next
tick, but the same score tick could still upsert it because the raw query selected `pool_eligible`
without passing it into `buildCandidatePoolRows`.

Decision:

- Add `pool_eligible` to `ScorableRawRow`.
- Pass `poolEligible: row.pool_eligible ?? null` into the pool-builder input.
- Keep the existing pool-builder hard block as the single policy owner:
  `poolEligible === false` → `pool_eligible_false`.

Live verification:

- A follow-up score tick reported `pool_eligible_false: 3` in pool skip reasons.
- The previously visible `408983830` row was removed by residue cleanup / hard-block path.
- Current ready/reserved shoe/bag/clothing pool is empty.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
git diff --check -- src/lib/tick-pipeline.ts docs/DECISIONS/2026-05-21-wave505-candidate-pool-parser-freshness-gate.md
```

Result: 121/121 tests passed; diff check passed.

## Wave 513 Addendum — Ready Pool Profit Recalculation Priority

After refreshing market stats, `407703779` (RRL denim jeans) still showed the previous candidate-pool
expected profit even though the latest market row lowered the clean-condition median from 441,600 KRW
to 348,680 KRW. The raw row was correctly marked `score_dirty=true`, but `loadScorableRows` ordered
dirty rows by `last_seen_at desc`, so an old-but-visible ready row could sit behind a large fresh dirty
backlog.

Decision:

- Add a ready/reserved pool priority feed at the start of `loadScorableRows`.
- Scan both oldest and newest ready/reserved pool rows, then fetch only those whose raw row is still
  `score_dirty=true` and scorable.
- Keep the feed capped at 50 rows per score tick so it refreshes visible candidates without starving
  normal scoring.

Live verification:

- Ran `marketStatsStage`; today's RRL clean-condition market row was recomputed:
  - active median: 379,000 KRW
  - blended median: 348,680 KRW
  - active sample count: 6
- Ran a small `scoreStage`; `407703779` was prioritized despite old `last_seen_at`.
- The row recalculated to `sku_median=348,680`, `net_gap_after_shipping=0`, and was invalidated with
  `negative_resell_gap`.
- Current ready/reserved shoe/bag/clothing pool is empty, which is the conservative outcome until
  rows have fresh market math plus AI pass.

Verification:

```bash
npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts
```

Result: 121/121 tests passed.
