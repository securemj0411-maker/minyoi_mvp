# 2026-05-21 Wave 434 — Margiela Tabi Flat Split

## Context
- Recent `/me` debug comment for pid `384929627` confirmed Tabi Boot itself was correctly parsed:
  - `shoe-margiela-tabi-boot`
  - comparable `shoe|tabi_boot|boot|260|a_grade`
- Follow-up DB inspection showed adjacent Tabi rows had a deeper issue:
  - `타비 플랫`, `발레 플랫`, `메리제인`, and `슬립온 타비` were sitting in broad `shoe-margiela-tabi`.
  - Broad Tabi rows without an explicit product type were being defaulted to `sneaker` by the shoe parser.
  - `카드 포함` in a sneaker listing was blocked by global fashion `카드` noise, even though it meant warranty/auth card included.

## Decisions
- Added `shoe-margiela-tabi-flat` for flat / Mary Jane / slip-on Tabi rows.
- Added shoe product types:
  - `flat`
  - `mary_jane`
- Blocked `shoe-margiela-tabi` broad from defaulting to `sneaker` when product type is unknown.
- Added EU half-size parsing near flat/Mary Jane shoe wording, including `37.5`.
- Kept `카드` as fashion noise generally, but allowed shoe rows where it appears as included/auth card:
  - `카드 포함`
  - `보증 카드`
  - `개런티 카드`
  - `정품 카드`
- Added Tabi accessory guards for `키링`, AirPods/case, and similar non-shoe rows.

## DB Writes
- Temporary sync script was created and removed after use.
- First sync:
  - `candidates=268`
  - `raw_found=268`
  - `parsed_upserted=174`
  - `raw_updates=134`
  - `parsed_deleted=10`
  - `pool_deleted=134`
- Follow-up after disabling broad Tabi sneaker default:
  - `candidates=267`
  - `raw_found=267`
  - `parsed_upserted=174`
  - `raw_updates=16`
  - `parsed_deleted=0`
  - `pool_deleted=16`
- Follow-up after paginating title search and allowing included card wording:
  - `candidates=278`
  - `raw_found=278`
  - `parsed_upserted=175`
  - `raw_updates=1`
  - `parsed_deleted=0`
  - `pool_deleted=1`
- Final distribution:
  - `shoe-margiela-tabi-boot`: 68
  - `shoe-margiela-tabi-sneaker`: 60
  - `shoe-margiela-tabi`: 27
  - `shoe-margiela-tabi-flat`: 16
  - `shoe-margiela-tabi-slipper`: 4

## Verified Examples
- pid `384929627` stayed `shoe-margiela-tabi-boot`
  - `shoe|tabi_boot|boot|260|a_grade`
- pid `408676947` -> `shoe-margiela-tabi-sneaker`
  - `shoe|tabi_sneaker|sneaker|235|a_grade`
- pid `408802199` -> `shoe-margiela-tabi-flat`
  - `shoe|tabi_flat|mary_jane|240|unknown_condition`
- pid `408857419` -> `shoe-margiela-tabi-flat`
  - `shoe|tabi_flat|flat|245|c_grade`
- pid `408994107` -> `shoe-margiela-tabi-flat`
  - `shoe|tabi_flat|flat|235|b_grade`
- pid `409022823` stayed `shoe-margiela-tabi-boot`
  - `shoe|tabi_boot|boot|235|unknown_condition|with_box`
- pid `409085921` cleared to null because it is a Tabi keyring.

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 144 pass / 0 fail.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 182 pass / 0 fail.

## Deferred
- Broad `shoe-margiela-tabi` remains as a review-heavy fallback for product types not yet split, especially pumps/loafers/sandals.
- Tabi slipper/sandal wording still deserves a separate audit because some legacy rows can have conflicting `slipper` vs `sandal` parser output.
- Rows with no explicit size remain `needs_review`; size inference from image or description-free EU numbers is deferred.
