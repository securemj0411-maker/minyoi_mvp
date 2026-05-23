# Wave 464 — shoe third chunk cleanup

Time: 2026-05-21 10:55 KST

## Context

Audited the next active shoe sample window, offset 5,000-7,500. Initial current-parser drift had 17 groups, led by New Balance 2002R, Hoka Bondi 8/9, New Balance 327/1300/1400/1600, Hoka Anacapa, Hermes Egerie, Mizuno, Louis Vuitton, and one non-shoe false positive.

## Decisions

1. Treat explicit collabs and non-shoe rows as stale.
   - Cleared JJJJound New Balance 2002R rows from the plain 2002R SKU.
   - Cleared WTAPS x Hoka Anacapa from the plain Anacapa SKU.
   - Cleared Joe Freshgoods New Balance 550 from the plain white/green 550 SKU.
   - Cleared a multi-brand New Balance 1600 limited collab.
   - Cleared Mizuno FUTEBOL DE SALAO short-sleeve warmup apparel from the Sala shoe SKU.
   - Cleared a Platinum Century fountain pen row from New Balance 1500.

2. Keep normal model-code/colorway rows when the model identity is clear.
   - Added conservative aliases for New Balance 2002R RAW, 327LAB/327FE, 1300JP/1300DSP, 1400JP, and 1600LG.
   - Added glued Korean Hoka Bondi forms, including `호카본디9`, `호카본디 8TS`, and `호카원본디 8`.
   - Allowed `알파카` color text so it no longer triggers the shoe-vs-parka clothing safety net.

3. Reduce false buy-request matches.
   - Seller/provenance phrases such as `3/19 구매`, `40중 후반 구매`, `노클레임에서 구매`, `구매 관련 문의`, `구매전 채팅` are not treated as buy requests.
   - Professional seller text such as `매입,위탁판매` and `매입 판매 상담` is treated as seller-service text.
   - Removed the bare end-of-string `구매` buy-request trigger because the 200-character description slice can cut seller text at exactly `구매`, producing false nulls.

## Applied

- DB: cleared 11 stale active rows.
- Parser/catalog: tightened New Balance and Hoka shoe aliases and purchase/seller text handling.
- Tests: added regression cases to `tests/wave254-6-product-type-priority.test.ts`.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 164 passed, 0 failed.
- `START_OFFSET=5000 MAX_ROWS=2500 PAGE_LIMIT=250 npx tsx scripts/wave464-shoe-currentdiff-audit.ts`
  - scanned 2,500 active shoe rows.
  - `groupsWithDiff=0`, `ranked=[]`.

## Deferred

- Continue active shoe current-diff audit from offset 7,500.
- Size/turnover bucket differences remain deferred to a later wave.
