# 2026-05-29 Wave 921 - Ready SKU generic image backfill

## Context
- Ready pool SKU additions exposed gaps where `mvp_sku_images` did not have a generic/default image row for some `sku_name`s.
- Feed cards can fall back to listing thumbnails, but the 1-credit detail/easy-mode preview path should have a stable SKU-level default image for every ready SKU.
- Polo Ralph Lauren/RRL rows had extra quality issues from the earlier pilot: generic Korean-heavy slugs collapsed into shared paths such as `polo.jpg`, and at least one Polo image was a wrong-brand product photo.

## Decision
- Add `scripts/sku-image-pilot/backfill_ready_missing_images.py` as the repeatable ready-pool audit/backfill tool.
- Use current ready-pool SKUs as the source of truth, compare against `mvp_sku_images`, download/resize candidate images, upload to Supabase Storage `sku-images`, and upsert `mvp_sku_images`.
- Refresh Polo/RRL images with Polo-specific query overrides and brand/domain scoring, and repair SKU paths that would otherwise collapse to generic Korean-heavy slugs.

## Applied
- Backfilled all ready SKU generic image gaps found in this pass.
- Manually repaired cases where automated image search was unsafe or wrong:
  - `Louis Vuitton LV Trainer`
  - `Gucci Ace Sneaker`
  - `NB × Kale (1906R 콜라보)` because the automated candidate was a vegetable image, not the CAYL/New Balance shoe.
  - `JBL GO 4` path normalized after a newly ready SKU appeared during the work.
- Replaced bad Polo/RRL generic images with more specific product images and unique storage paths.

## Verification
- Final dry-run report:
  - `ready_rows`: 1764
  - `distinct_ready_sku_names`: 457
  - `sku_image_rows`: 484
  - `missing_generic_sku_count`: 0
  - `missing_generic_ready_rows`: 0
  - `slug_repair_target_count`: 0
  - `target_count`: 0
- `python3 -m py_compile scripts/sku-image-pilot/backfill_ready_missing_images.py` passed.

## Deferred
- Turn this into a scheduled or post-SKU-addition maintenance job. The script now exists, but the recurring trigger is not wired yet.
- Automated image search can still produce semantically wrong candidates, so high-risk brand/collab lanes should keep manual QA or stricter source allowlists.
