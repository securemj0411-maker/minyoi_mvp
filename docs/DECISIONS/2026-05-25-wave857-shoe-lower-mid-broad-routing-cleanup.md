# Wave 857 — Shoe lower-mid broad routing cleanup

## Context

After wave 856, the shoe safety report had no `fix_now`, but the next `watch_internal_only` batch still had broad lanes where current samples showed stale routing and variant pollution. This wave reviewed:

- `shoe-skechers-broad`
- `shoe-adidas-samba-broad`
- `shoe-salomon-rx-slide-broad`
- `shoe-newbalance-1906a-broad`
- `shoe-y3-broad`
- `shoe-drmartens-1460-black`
- `shoe-ugg-classic-broad`
- `shoe-adidas-song-for-the-mute-broad`
- `shoe-keen-broad`
- `shoe-newbalance-generic-broad`

## Decisions

1. Keep variant/collab RX Slide rows out of plain Salomon RX Slide 3 samples: Beams, The Broken Arm, LTR/leather/cork, and Moc.
2. Keep Samba Rose and Samba Vegan out of plain Samba broad samples.
3. Restore `Dr. Martens 1460 Black` as a ready lane with a real laneKey, while excluding Mono/Pascal/Virginia/Wintergrip/Ambassador and non-8-hole variants from that exact color lane.
4. Keep UGG Chelsea/rainboot rows out of Classic broad.
5. Prevent Adidas SFTM clothing from absorbing SFTM shoes by requiring a garment token on the clothing lane and blocking shoe terms there.
6. Keep New Balance generic broad as a fallback only. Exact model/collab rows now leave generic:
   - 610 / ML610T / ML610TBF / ML610TBG -> `shoe-newbalance-610-broad`
   - ML725Q -> `shoe-newbalance-725-broad`
   - 1080v13 -> `shoe-newbalance-1080-broad`
   - MT10TDS/Tokyo Design Studio -> `shoe-newbalance-tds-collab`
   - ALD 860v2 -> `shoe-newbalance-aime-leon-dore-collab`
   - Miu Miu / 442 / football boot rows -> null/review
7. Treat `running cap` / `camp cap` / `러닝캡` / `캠프캡` as shoe-category noise so cap listings cannot enter any shoe SKU sample.

## Code changes

- Added RX Slide variant/collab blockers to exact and broad Salomon lanes.
- Added Samba Rose/Vegan blockers to Samba broad.
- Added `drmartens_1460_black` lane readiness and variant blockers.
- Added UGG Classic Chelsea/rainboot blockers.
- Tightened Adidas SFTM clothing lane with garment-token requirements and shoe-token blockers.
- Added New Balance compact model aliases for 610, 725, 1080v13, and Tokyo Design Studio rows.
- Added 610/ML610 blockers to New Balance generic broad so exact 610 can win over fallback.
- Added `러닝캡`/`캠프캡`/`running cap`/`camp cap` to global shoe category noise.
- Added regression coverage for wave 857 routes and Supreme Nike Air Max cap pollution.

## Applied DB routing

Wave 857 broad batch apply:

- scannedParsedRows: 286
- rawRows: 286
- candidateRows: 85
- reclassifyRows: 39
- refreshParsedRows: 21
- rejectRows: 25

Notable rows:

- Salomon RX Slide broad -> `shoe-salomon-rx-slide-3`: 22 rows
- Salomon RX Slide broad -> null/review: Beams, The Broken Arm, LTR/leather/cork, and Moc rows
- Samba broad -> null/review: Samba Rose and Samba Vegan rows
- Y-3 broad -> `shoe-adidas-y3-collab`: pid `331279314`
- Dr. Martens 1460 Black -> `shoe-drmartens-1460-mono`: pid `409047777`
- Dr. Martens 1460 Black -> `shoe-drmartens-broad`: Wintergrip and 10-hole Virginia rows
- Dr. Martens 1460 Black -> null/review: Pascal Ambassador 6-hole row
- UGG Classic broad -> exact UGG lanes: Mini II, Mini Dipper, Ultra Mini Platform, Mini Platform
- UGG Classic broad -> null/review: Chelsea/rainboot rows
- New Balance generic broad -> exact/collab lanes: TDS, ALD, 725, 610, 1080
- New Balance generic/Miu Miu rows -> null/review: Miu Miu, m990 stale, football boot, and 442/Miu Miu rows

Supreme Nike Air Max cap pollution fix:

- pid `387577853`: `슈프림 나이키 에어맥스 러닝캡` -> null/review
- pid `399789984`: `(OS) 슈프림 나이키 에어맥스 캠프캡 모자 스네이크 스킨` -> null/review
- scannedParsedRows: 2
- rejectRows: 2

## Verification

- Regression: `npx tsx --test tests/fashion-catalog-regression.test.ts` passed 56/56.
- Wave 857 stage after broad apply:
  - queued: 192
  - poolUpserted: 1491
  - reveal_current_profit_updated: 30
  - reveal_current_profit_invalidated: 11
- Gate cleanup after broad apply:
  - candidateRows: 3
  - applied shoe rows: 3
- Supreme cap backfill stage:
  - queued: 3
  - poolUpserted: 38
- Final gate cleanup:
  - candidateRows: 0
- Final safety:
  - shoe readySku 81, safe_public 79, probably_safe 2, fix_now 0
  - clothing readySku 48, safe_public 40, probably_safe 8, fix_now 0

## Deferred

- Do not promote lower-mid broad lanes solely from this sweep. They remain watch/internal unless exact model lanes have enough clean sample history.
- Adidas SFTM shoe broad still needs exact model split later if public release is desired: Country OG, Taekwondo, Adistar, Shadowturf, and model-missing rows are currently not promoted as a ready lane.
- Continue the shoe sweep with the next high-eligible `watch_internal_only` broad lanes from the safety report: New Balance 327, Gucci broad, Converse Chuck70 High, Adidas Tobacco, Prada broad, New Balance 574, Shox R4, Balenciaga Triple S, Cortez, Superstar, Dior/Hermes/LV broad, Tiempo/Mercurial, NB530, Shox TL, Chuck All Star, Vans Vault, Dr. Martens broad.
