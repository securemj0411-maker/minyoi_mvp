# 2026-05-21 Wave 430 — TNF Nuptse and RRL jacket comment splits

## Decisions
- Reviewed the remaining operator debug comments after Wave 429 and targeted two high-confidence comparable contamination groups:
  - TNF Nuptse 1996
  - RRL jacket / coat
- TNF Nuptse:
  - Kept true `1996 Retro Nuptse` rows in `clothing-tnf-nuptse-1996`.
  - Re-routed non-1996 Nuptse rows to `clothing-tnf-nuptse-broad`.
  - Cleared vest / eco rows to `sku_id=null` when current catalog rules intentionally reject them.
- RRL jacket:
  - Split repeated sub-lines out of generic `clothing-polo-rrl-jacket-coat`:
    - `clothing-polo-rrl-browns-beach-jacket`
    - `clothing-polo-rrl-denim-jacket`
    - `clothing-polo-rrl-grizzly-jacket`
  - Kept ambiguous canvas / deck / bomber / fleece jacket rows in `clothing-polo-rrl-jacket-coat`.
  - Fixed a transient conflict where canvas trucker rows briefly fell to `sku_id=null`; restored them to generic RRL jacket-coat and added a regression case.

## DB writes
- TNF:
  - Scanned 16 rows from `clothing|tnf_nuptse_1996|down_jacket|unknown_condition`.
  - Reclassified 10 rows to `clothing-tnf-nuptse-broad`.
  - Cleared 3 rows (`vest` / `eco`) to `sku_id=null` and deleted their stale parsed rows.
  - Deleted candidate-pool rows for 16 affected pids.
- RRL:
  - Scanned 52 RRL jacket parsed rows across `a_grade`, `s_grade`, `b_grade`, and `unknown_condition`.
  - Reclassified 1 Brown's Beach row, 15+ denim jacket rows, 7 Grizzly rows, and several leather/suede rows that current rules already route to the leather/suede lane.
  - Restored 3 canvas/trucker rows to generic `clothing-polo-rrl-jacket-coat`.
  - Deleted candidate-pool rows for affected pids so stale comparable keys are not exposed.

## Verified Comment PIDs
- `385621739` (`노스페이스 눕시 1996 해외판 브라운`) remains:
  - raw SKU: `clothing-tnf-nuptse-1996`
  - comparable key: `clothing|tnf_nuptse_1996|down_jacket|unknown_condition`
- TNF comparison group after sync contains only 3 active 1996 rows:
  - `[US S] 노스페이스 1996 레트로 눕시`
  - `노스페이스 1996 눕시 블랙 다운 자켓`
  - `노스페이스 눕시 1996 해외판 브라운`
- `325358167` (`더블알엘 RRL 브라운스비치 헤링본 자켓`) now:
  - raw SKU: `clothing-polo-rrl-browns-beach-jacket`
  - comparable key: `clothing|polo_rrl_browns_beach_jacket|jacket|a_grade`
- RRL split checks after sync:
  - generic RRL jacket a-grade: 6 rows
  - Brown's Beach a-grade: 1 row
  - denim jacket a-grade: 6 rows
  - Grizzly jacket a-grade: 7 rows

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 175 pass, 0 fail.

## Deferred
- TNF vest / eco / white-label / center-logo can become separate lanes only after enough repeated safe samples.
- RRL Brown's Beach currently has only one a-grade sample; it is separated to avoid polluting generic RRL jacket pricing, but should remain low-confidence until density improves.
- RRL denim jacket still spans LOT271, West View, engineer, field, and railroad lines; further split only if repeated model tokens create dense enough groups.
