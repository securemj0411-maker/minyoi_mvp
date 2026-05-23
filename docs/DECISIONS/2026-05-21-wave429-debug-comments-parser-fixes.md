# 2026-05-21 Wave 429 — Debug comment parser fixes

## Decisions
- Reviewed recent `mvp_reveal_feedback.note` debug comments from the operator pool and prioritized deterministic parser/catalog defects first.
- Fixed AirPods 4 no-ANC wording:
  - `에어팟 4세대 노캔 ㄴㄴ`, `노캔 안돼`, `노캔 안되는`, and `노이즈캔슬링 안되는` now route to regular `airpods-4`, not `airpods-4-anc`.
  - Kept positive `에어팟 4세대 노캔` / `노이즈 캔슬링 기능 있습니다` in `airpods-4-anc`.
  - Preserved raw `ㄴㄴ` before Unicode normalization in both catalog direct matching and the AirPods option parser.
- Split shoe football comparable model keys by brand:
  - `shoe-adidas-football` -> `adidas_football`
  - `shoe-puma-football` -> `puma_football`
  - This prevents Adidas Predator/F50 samples from mixing with Puma Ultra/Future/King rows under a single `shoe|football|...` key.
- Fixed clothing `폴로티셔츠` / `폴로티` parsing so Lacoste pique/polo shirts become `polo_shirt`, not generic `tee`.

## DB writes
- Reclassified 62 AirPods 4 rows from `airpods-4-anc` raw SKU to `airpods-4` when current catalog matching found clear no-ANC wording.
- Reparsed 93 AirPods 4 rows with no-ANC-like wording after the parser fix.
- Reparsed 831 active Adidas/Puma football shoe rows with brand-specific comparable keys.
- Reparsed 45 active Lacoste pique/polo rows with `폴로티` / `폴로티셔츠` wording.
- Deleted candidate-pool rows for 938 affected pids so stale old comparable keys are not exposed before rebuild.

## Verified Comment PIDs
- `401588656` (`에어팟 4세대 노캔 ㄴㄴ`) now:
  - raw SKU: `airpods-4`
  - comparable key: `airpods|airpods_4|usbc|no_anc`
  - `needs_review=false`
- `392662804` (`애플 에어팟 4세대 한번 사용 노캔 안 돼요`) now:
  - raw SKU: `airpods-4`
  - comparable key: `airpods|airpods_4|usbc|no_anc`
- `408863221` (`에어팟 4세대 노캔`) remains correctly in:
  - raw SKU: `airpods-4-anc`
  - comparable key: `airpods|airpods_4_anc|usbc`
- `335841370` (`아디다스 프레데터 엣지.1`) now:
  - model: `adidas_football`
  - comparable key: `shoe|adidas_football|sneaker|260|a_grade`
- `332151960` (`라코스테 슬림핏 폴로티셔츠 블루`) now:
  - comparable key: `clothing|lacoste_pique_polo|polo_shirt|a_grade`

## Verification
- `npx tsx --test tests/core-rules.test.ts tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 273 pass, 0 fail.
- Follow-up focused test:
  - `npx tsx --test tests/core-rules.test.ts tests/wave254-6-product-type-priority.test.ts`
  - 235 pass, 0 fail.
- Checked `airpods|airpods_4_anc|usbc` after DB sync:
  - total rows: 444
  - no-ANC contamination rows found by targeted regex: 0

## Deferred
- Nuptse 1996 vs vest / white-label / remaster / 500-line split needs a separate TNF outerwear wave.
- RRL Brown's Beach / denim / grizzly / canvas jacket split needs a separate RRL outerwear wave.
- Acne Max / 1995 / black jean split needs a denim-model wave.
- Supreme bag field-side / puffer / side-bag split and Bottega Cassette material/shape split remain visual/model-line work, not safe as a quick parser-only fix.
- Superstar II vs broader Superstar generation split needs sample density review before creating a new lane.
