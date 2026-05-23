# 2026-05-21 Wave 488 — Fashion tail current-diff cleanup

## Context
- Continued the conservative fashion/shoe/bag SKU cleanup after Wave 487.
- Focus was not to widen ready coverage, but to remove stale assignments and keep comparison groups from mixing collabs, derivative lines, accessories, and broad fallback rows.

## Decisions
- Treat MM6 / Maison Margiela as global designer-collab noise for unrelated broad lanes, while allowing intended MM6/Margiela SKUs to match via SKU brand/alias identity.
- Keep `clothing-mm6-margiela` narrow by blocking Supreme/TNF collaboration rows from falling into the plain MM6 lane.
- Keep Patagonia Classic Retro-X / Synchilla / Snap-T together for now, but split out Retro Pile rows by blocking `레트로파일`, `레트로 파일`, `retro pile`, and `retro-pile` from Retro-X and Patagonia broad fallback.
- Allow `레트로X` no-space Korean notation as a valid Retro-X signal.
- Treat `공식사이트 구매` as purchase-history text, not a buy-request marker.

## DB changes
- Applied 62 active-row stale assignment fixes across Champion, Adidas bag, BAPE, Reebok, Kitsune, MM6/Margiela, Samba, CDG, TNF/Supreme, Onrunning PAF, Margiela Tabi, Nike Air Max, Adidas Adilette, and Supreme broad tail rows.
- Cleared 22 active Patagonia Retro Pile stale rows from `clothing-patagonia-retro-x` to `sku_id = null`.
- Restored one true active Retro-X row, `pid=165352400` (`파타고니아 클래식 레트로X (새상품)`), after purchase-history wording was fixed.
- All DB writes marked `score_dirty = true`.

## Deferred
- Do not create a separate Patagonia Retro Pile lane yet. The rows are coherent but need a small sample/price check before being made ready.
- Do not widen Onrunning PAF or ambiguous collab lines yet; current policy is to clear them unless the model family is explicit enough.
- Arc'teryx Gamma tail rows still need a careful follow-up because `Gamma MX Hoody` may be a true positive while pants/shorts variants should be separated or cleared.

## Verification
- Targeted recheck across the Wave 488 tail SKU set returned `[]` (no active current-diff rows).
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` passed 189/189.
- `npx tsx --test tests/core-rules.test.ts` passed 101/101.
