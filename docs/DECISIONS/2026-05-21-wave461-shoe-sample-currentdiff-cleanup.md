# 2026-05-21 Wave461 — Shoe sample currentDiff cleanup

## Context

- After Wave460 target cleanup, ran a broader active shoe sample audit.
- Initial all-row audit was too heavy, so the audit was capped to 2,500 active `shoe-*` rows with page progress.
- First 2,500-row sample showed 14 SKU groups with current parser / DB `sku_id` drift.

## Decisions

- Cleared stale DB rows from plain lanes when current parser intentionally rejects them:
  - 22 Asics Gel-Kayano collab rows from plain `shoe-asics-gel-kayano`.
  - 5 Adidas Adizero apparel/collab rows from plain `shoe-adidas-adizero`.
  - 4 Adidas SL72 Wales Bonner / RS rows from plain `shoe-adidas-sl72`.
  - 3 Adidas FOG apparel or multi-model rows from `shoe-adidas-fog-collab`.
  - 3 Gazelle Indoor color/collab rows from `shoe-adidas-gazelle-indoor-bold-orange`.
  - 1 Samba OG black row missing brand/color signal.
  - 1 Adidas Ultraboost Mastermind collab row from plain Ultraboost.
  - 1 Adidas Adilette Pharrell / Human Race row from plain Adilette.
  - 1 Ader Error Converse Significant variant row deferred out of the generic collab lane.
  - 1 Clarks x Adidas x Kith Samba row deferred out of the current Kith Samba lane.
  - 1 Spezial residual description-noise row deferred out of sample.
- Migrated 2 Samba rows from `shoe-adidas-samba-og-black` to `shoe-adidas-samba-og-broad` when no black color signal was present.
- Fixed parser false-null cases caused by normal purchase-history copy:
  - Added safe purchase-history patterns for `발매가/정가/구매가`, `스탁엑스/스턱엑스`, `아디다스코리아`, and seller `구매시 무료배송` text.
  - Preserved actual buy-request blocking.
- Fixed Adizero normal color text:
  - `오프화이트/off-white` is allowed as an Adizero/Adios colorway when it is not an explicit Off-White collab.
- Relaxed global fashion `느낌` noise only for harmless descriptive phrases such as `빈티지한 느낌`; brand-bait phrasing remains blocked.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 164 pass, 0 fail.
- Post-apply 2,500-row active shoe sample audit:
  - `groupsWithDiff=0`
  - `ranked=[]`

## Deferred

- Full uncapped active-shoe audit is still too slow and should be chunked by SKU family or run as a background/report task.
- Ader Error Converse Significant, Clarks x Adidas x Kith Samba, SL72 Wales Bonner, and Gel-Kayano collab families are deferred as potential future narrow lanes if clean volume warrants it.
- Spezial residual description-noise behavior should be debugged later instead of broadening matcher behavior under pressure.
