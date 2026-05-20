# 2026-05-20 Wave421 - Bag Broad Safety Tightening

## Context
- Shoe/clothing broad cleanup 이후 bag broad도 지갑/이너백/화장품/의류/신발/타브랜드가 섞일 가능성을 점검했다.
- 특히 `백화점판` 같은 문구가 bare `백` 신호로 가방 broad에 들어가는 문제, Coach duplicate/broad-vs-narrow 충돌, Prada beauty gift가 Pocono bag으로 들어가는 문제가 확인됐다.

## Decisions
- `tokenHit`에서 Korean bare `백`은 suffix signal로 유지하되 `백화점`, `백스테이지`는 bag product-type signal이 되지 않도록 차단했다.
- Bag category 공통 noise에 beauty/cosmetic gift token을 추가해 broad뿐 아니라 legacy/narrow bag SKU도 beauty gift 매물을 막도록 했다.
- Wave266 generated Coach duplicate broad(`bag-coach-apparel-broad`)는 제거했다. 기존 ready lane `bag-coach-broad`가 Coach broad fallback을 담당한다.
- `bag-coach-signature-tote`는 generic `코치 토트/캔버스`로 과승격하지 않도록 `시그니처/signature` 또는 `카메라/camera` 신호를 요구하게 좁혔다.
- Prada Re-Edition 2005 Tessuto/Hobo는 새 SKU를 만들지 않고 기존 `bag-prada-nylon-hobo-vintage` mustContain에 `테수토/tessuto/1BH204`를 추가했다.
- Dior J'ADIOR slingback은 Dior bag broad가 아니라 shoe broad로 빠지도록 bag broad noise를 보강했다.

## DB Rematch Applied
- Target broad rows 223개를 replay해 안전한 20개만 적용했다.
- Non-null reroute:
  - `bag-dior-broad -> bag-miumiu-broad`: 1
  - `bag-dior-broad -> shoe-dior-broad`: 1
  - `bag-prada-broad -> bag-prada-nylon-hobo-vintage`: 1
- Null cleanup:
  - Dior beauty/shopping/knit rows: 8
  - Louis Vuitton shopping-box/jeans/knit rows: 4
  - Lemaire inner-bag/Uniqlo rows: 2
  - Hermes shopping bag: 1
  - Prada beauty gift: 1
  - Coach Coccinelle false match: 1

## Verification
- `tests/wave254-6-product-type-priority.test.ts`: 99 pass / 0 fail.
- Related regression bundle: 267 pass / 0 fail.
- Targeted replay after DB apply: scanned 207, remainingChanges 0.
- `report-fashion-pool-purity`: activeFashionPoolRows 50, gateBlockedRows 0, flaggedRows 0, actionableRows 0.
- `cleanup-fashion-pool-gate-blocked --include-key-drift`: candidateRows 0 after cleanup apply.
- Score drains ran with AI review and shadow audit disabled: `aiApiCalls=0`.

## Deferred
- Remaining dirty queue rows after final check were unrelated live fashion rows (mostly Stussy blocked/internal lanes), not bag broad rematch residue.
- Additional popular bag narrow expansion remains separate work: Celine Triomphe/Boston, Dior Lady/Saddle/Bobby, Prada Re-Nylon/Re-Edition variants, Lemaire Game/Fortune/Croissant, etc.
