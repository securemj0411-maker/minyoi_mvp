# 2026-05-21 Wave 432 — Supreme Side Bag Splits

## Context
- Recent `/me` debug comment for pid `409253404` showed `Supreme Shoulder / 메쉬 / 반다나 사이드백` comparing:
  - Bandana/Tarp side bag
  - Field side bag
  - Puffer side bag
- The generic `bag-supreme-shoulder` lane also still contained some mesh 5-panel cap rows through stale DB rows.

## Decisions
- Split repeated Supreme side-bag text lines into separate conservative lanes:
  - `bag-supreme-bandana-tarp-side`
  - `bag-supreme-field-side`
  - `bag-supreme-puffer-side`
- Kept plain side/shoulder/mesh bags in `bag-supreme-shoulder`.
- Added `5패널/5 panel/cap/스냅백` noise to the generic Supreme shoulder lane so mesh-cap rows no longer enter bag comparables.
- Added both `퍼퍼` and `푸퍼` spellings for puffer side bag.

## DB Writes
- First sync:
  - `candidate pids=168`
  - `rawPatches=64`
  - `parsedUpserts=67`
  - `parsedDeletes=13`
  - `poolDeletes=64`
- Follow-up sync after adding `푸퍼` spelling:
  - `candidate pids=162`
  - `rawPatches=1`
  - `parsedUpserts=63`
  - `parsedDeletes=0`
  - `poolDeletes=1`
- Verified examples:
  - pid `409253404` -> `bag|bandana_tarp_side|crossbody|era_unknown|unknown_size_variant|b_grade`
  - pid `345546643` -> `bag|field_side|crossbody|era_unknown|unknown_size_variant|b_grade`
  - pid `376318488` -> `bag|puffer_side|crossbody|era_unknown|unknown_size_variant|b_grade`
  - pid `383325866` -> `bag|puffer_side|crossbody|era_unknown|unknown_size_variant|a_grade`
  - pid `388121498` -> cleared to null because it is a mesh 5-panel cap.
  - pid `401427877` -> cleared to null because it is a mesh 5-panel cap.

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 140 pass / 0 fail.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 178 pass / 0 fail.

## Deferred
- TNF x Supreme bag misroutes remain a later wave:
  - Some `슈프림 x 노스페이스` shoulder/waist/lumber bag rows still route through older TNF/Supreme broad logic.
  - That needs a separate collab-bag split, not a plain Supreme-side-bag patch.
- Season/color-specific Supreme shoulder bags are not split yet unless they repeat with strong model text.
