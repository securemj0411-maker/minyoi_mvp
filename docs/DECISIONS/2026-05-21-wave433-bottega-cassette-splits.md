# 2026-05-21 Wave 433 — Bottega Cassette Variant Splits

## Context
- Recent `/me` debug comment for pid `405817321` showed `Bottega Veneta mini padded tech cassette` comparing against a different-looking small padded leather cassette row.
- Existing `bag-bottega-cassette-mini` was too broad and absorbed repeated Cassette variants:
  - Padded Tech Cassette
  - Padded / padded leather Cassette
  - Mini Camera / Cobble Cassette
  - Mini Bucket Cassette
  - Cassette wallets / organizers
- This polluted comparable groups because very different bag shapes and retail lines shared the generic `bag|cassette_mini|...` key.

## Decisions
- Added conservative narrow lanes:
  - `bag-bottega-cassette-padded-tech`
  - `bag-bottega-cassette-padded`
  - `bag-bottega-cassette-camera`
  - `bag-bottega-cassette-bucket`
- Kept `bag-bottega-cassette-mini` only for generic mini cassette bag rows without padded/tech/camera/bucket/wallet signals.
- Expanded wallet matching to include `오거나이저`, `organizer`, `3단`, `폴더형`, and `미니지갑`.
- Added must-not guards to generic mini so repeated lines no longer fall through to the old comparable bucket.

## DB Writes
- Temporary sync script was created and removed after use.
- Candidate scope:
  - `candidates=308`
  - `raw_found=308`
  - `parsed_upserted=83`
  - `raw_updates=74`
  - `parsed_deleted=10`
  - `pool_deleted=74`
- New parsed distribution:
  - `bag-bottega-cassette-mini`: 45
  - `bag-bottega-cassette-padded`: 22
  - `bag-bottega-cassette-wallet`: 6
  - `bag-bottega-cassette-padded-tech`: 4
  - `bag-bottega-cassette-bucket`: 4
  - `bag-bottega-cassette-camera`: 2
- Changed rows were marked `score_dirty=true` and `pool_eligible=false`; matching candidate-pool rows were removed so stale public pool entries cannot survive the split.

## Verified Examples
- pid `405817321` -> `bag-bottega-cassette-padded-tech`
  - comparable: `bag|cassette_padded_tech|crossbody|era_unknown|unknown_size_variant|a_grade`
- pid `402608710` -> `bag-bottega-cassette-padded`
  - comparable: `bag|cassette_padded|crossbody|era_unknown|unknown_size_variant|a_grade`
- pid `377554940` -> `bag-bottega-cassette-camera`
  - comparable: `bag|cassette_camera|crossbody|era_unknown|unknown_size_variant|a_grade`
- pid `404394340` -> `bag-bottega-cassette-bucket`
  - comparable: `bag|cassette_bucket|shoulder|era_unknown|unknown_size_variant|c_grade`
- pid `409240097` -> `bag-bottega-cassette-bucket`
  - comparable: `bag|cassette_bucket|shoulder|era_unknown|unknown_size_variant`
- pid `391260393`, `392799895`, `381294691` -> `bag-bottega-cassette-wallet`

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 141 pass / 0 fail.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 179 pass / 0 fail.

## Deferred
- Color/material-specific splits are not added unless they repeat with strong model-code or product-line text.
- Image-only distinction remains deferred; this wave only trusts title/description/product-code signals.
- Margiela Tabi boot/sneaker/flat/lace-up cleanup remains the next comment-driven wave.
