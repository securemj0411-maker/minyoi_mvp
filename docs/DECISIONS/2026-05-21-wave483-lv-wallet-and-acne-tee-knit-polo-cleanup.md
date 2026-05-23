# 2026-05-21 Wave 483 — LV wallet spacing / Acne tee-knit-polo cleanup

## Context
- Wave 482 이후 첫 5000개 fashion audit에서 `bag-lv-zippy-wallet-monogram` 4건과 `clothing-acne-tee` 4건이 상위 잔여 currentDiff로 남았다.
- LV 지피/사라 월릿은 `지피 월릿`, `지피월릿`, `사라 월릿` 같은 한글 spacing variant가 narrow SKU로 안정적으로 들어가지 않았다.
- Acne tee 잔여는 니트/폴로/반팔 티셔츠가 한 SKU에 섞인 상태였다.

## Decisions
- LV wallet direct lane 보강:
  - LV/Louis Vuitton + 지피월릿/지피 장지갑 → `bag-lv-zippy-wallet-monogram`
  - LV/Louis Vuitton + 사라월릿/사라 장지갑 → `bag-lv-sarah-wallet-monogram`
  - 다미에/에삐/앙프렝뜨/코인/콤팩트/그래피티는 monogram wallet lane에서 제외.
- Acne apparel direct lane 보강:
  - Acne + 니트/스웨터/가디건 → `clothing-acne-knit`
  - Acne + 반팔/티셔츠/긴팔티 계열 → `clothing-acne-tee`
  - 단, 니트/폴로/후드/맨투맨/스웻/포바/원피스 및 기존 브랜드-bait 토큰은 tee direct에서 제외.

## Applied DB Patch
- Moved to `clothing-acne-knit` / `Acne Studios Knit / Cardigan`, `score_dirty=true`:
  - `361562636`, `378770914`
- Moved to `clothing-acne-polo` / `Acne Studios Polo / Rugby Shirt`, `score_dirty=true`:
  - `408976531`

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` passed.
- `npx tsx --test tests/core-rules.test.ts` passed.
- Targeted currentDiff check for `clothing-acne-tee`, `clothing-acne-knit`, `clothing-acne-polo`, `bag-lv-zippy-wallet-monogram`, `bag-lv-sarah-wallet-monogram` returned 0 rows.

## Deferred
- LV wallet color/material-specific sublanes remain deferred. This wave only preserves existing monogram wallet lanes and blocks obvious non-monogram materials.
- Acne knit tee vs true sweater/cardigan could be split later if enough repeated samples show materially different price buckets.
