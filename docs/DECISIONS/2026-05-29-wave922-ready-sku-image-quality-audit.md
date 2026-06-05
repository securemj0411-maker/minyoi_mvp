# 2026-05-29 Wave 922 - Ready SKU image quality audit

## Context
- The previous backfill verified every ready SKU has a generic image row, but that does not guarantee each image is specific enough.
- A follow-up audit checked ready-only SKU images for suspicious source domains, duplicate storage paths, and broad/catch-all image picks.

## Decision
- Treat `missing image`, `duplicate storage_path`, and suspicious mirror/blog/news sources as hard failures for ready-pool SKU defaults.
- Keep broad/catch-all SKU lanes when the taxonomy itself is broad, but use a representative product image rather than collage, unrelated apparel, or suspicious mirror assets.
- Keep `Asics Novablast / Superblast (러닝)` on a dedicated `asics-novablast-superblast` slug so it does not share `shoe-asics-novablast.jpg`.

## Applied
- Repaired these ready SKU image rows in Supabase Storage and `mvp_sku_images`:
  - `MLB Cap (broad)`
  - `BAPE Hoodie Zip (basic/camo, non-Shark)`
  - `Supreme × TNF 1996 Nuptse`
  - `Fear of God 자체 라인 (8th 모크 / 로퍼 / 디스턴스 러너 / 캘리포니아 뮬 / 101 레이스업)`
  - `진삼국무쌍 시리즈 (Switch broad)`
  - `Asics Novablast / Superblast (러닝)`
  - `Nike × Kendrick Lamar Cortez Slip-on`
  - `Air Jordan 11 (broad — Mid/일반)`
  - `Call of Duty 시리즈 (PS broad)`
  - `Game Boy / Color 게임 (broad — vintage)`
  - `Nike Pegasus Turbo (Broad)`
- Updated `backfill_ready_missing_images.py` with a slug override for the Asics combined lane and duplicate slug protection.

## Verification
- Ready-only audit after repairs:
  - `ready_rows`: 1774
  - `distinct_ready_sku_names`: 457
  - `missing_image_names`: 0
  - `duplicate_storage_paths`: 0
  - suspicious source or duplicate-path failures: 0
- Remaining duplicate source URL is only Apple official support image reused by Apple Watch SE size variants, which is acceptable for current defaults.

## Deferred
- Broad/catch-all SKU lanes still exist by taxonomy design. Making every image truly product-specific would require splitting or deactivating those broad SKU lanes, not only changing images.
