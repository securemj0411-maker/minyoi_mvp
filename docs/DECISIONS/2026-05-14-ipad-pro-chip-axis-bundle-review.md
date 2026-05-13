# 2026-05-14 — iPad Pro chip-axis comparable key + bundle review gate

## Trigger

Owner observed a suspicious candidate:

- `Ipad Pro11 3세대/256GB/Wifi/m1칩` at 850,000 KRW with +343,750 KRW expected profit
- Comparable live listing: `아이패드프로3세대 11 m1 셀룰러 + 애플펜슬2` at 760,000 KRW, description says 128GB Cellular plus Apple Pencil 2

These rows should not be compared as the same market lane.

## Root Cause

`option-parser-v31` extracted tablet chip information, but generic iPad Pro/Air comparable keys did not include the chip/generation axis.

Before the fix, generic iPad Pro rows could collapse across chip generations when screen/storage/connectivity matched:

- `ipad|ipad_pro|11in|256gb|wifi`

That can mix M1/M2/M4 iPad Pro rows and inflate median/profit. Apple Pencil/Magic Keyboard bundle rows were also not review-gated, so bundle prices could pollute clean tablet market references.

## Change

Updated `src/lib/option-parser.ts`:

- infer iPad Pro chip from generation + screen size where deterministic
  - iPad Pro 11: 3rd=M1, 4th=M2, 5th=M4
  - iPad Pro 12.9/13: 5th=M1, 6th=M2, 7th=M4
- infer iPad Air chip from generation where deterministic
  - 5th=M1, 6th=M2, 7th=M3
- include chip axis for generic `ipad_pro` / `ipad_air` comparable keys
- add `unknown_chip` as critical unknown for generic tablet rows
- review-gate Apple Pencil / Magic Keyboard / case bundle pricing with `tablet_bundle_price_review`

Exact narrow SKU lanes such as `ipad_pro_11_m4_256_wifi` keep their existing exact-model comparable shape.

## Reproduction After Fix

Owner candidate:

- title: `Ipad Pro11 3세대/256GB/Wifi/m1칩`
- comparable key: `ipad|ipad_pro|m1|11in|256gb|wifi`
- needsReview: `false`

Owner comparison listing:

- title: `아이패드프로3세대 11 m1 셀룰러 + 애플펜슬2`
- description: `아이패드 프로 3세대 11인치 M1 칩 128gb 셀룰러 모델과 애플펜슬 2세대 함께 판매합니다.`
- comparable key: `ipad|ipad_pro|m1|11in|128gb|cellular`
- needsReview: `true`
- reason: `tablet_bundle_price_review=true`

## Verification

- `npm run test:core` => 136/136 pass
- `npx eslint src/lib/option-parser.ts tests/core-rules.test.ts --max-warnings=0` => pass
- `npx tsc --noEmit --pretty false` => pass

## Follow-up

Existing DB rows parsed with older generic tablet keys can remain stale until reparse. Next safe step is a small dry-run tablet reparse scope:

- target `category=tablet`
- focus comparable keys starting with `ipad|ipad_pro|`
- measure stale candidate_pool rows whose comparable key gains chip axis or bundle review
- do not apply DB mutation until the dry-run shows candidate_pool/public impact

## DB Dry-run Snapshot

Read-only replay against production parsed tablet rows matching `ipad|ipad_pro|*`:

- audited parsed rows: 573
- comparable key changed under current parser: 573
- needs_review changed: 301
- bundle review rows: 263
- owner-reported candidate pid `404092678` changes from `ipad|ipad_pro|11in|256gb|wifi` to `ipad|ipad_pro|m1|11in|256gb|wifi`

This confirms the UI anomaly can persist until stale DB rows are reparsed. Apply remains deferred; the next implementation unit should create a tablet-only reparse/backfill plan with candidate_pool impact accounting.
