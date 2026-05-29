# Wave 962 — Fashion Historical Condition Sweep

Date: 2026-05-30 KST

## Context

User asked whether the condition parsing work had actually swept enough DB rows, not just a few hand-picked examples. Previous Wave 959 documented that the earlier coverage was not a full historical fashion sweep. This wave expands the audit tool to inspect parsed historical fashion rows directly and applies parser fixes only for recurring real marketplace wording.

## Decisions

- Added `--scope=parsed` to `scripts/report-fashion-condition-deepsweep.ts` so the audit can sample historical `mvp_listing_parsed` rows by category, not only current ready/reserved pool rows.
- Ran a stratified parsed sweep of 30,000 rows:
  - shoe: 10,000
  - clothing: 10,000
  - bag: 10,000
- Treated the sweep as read-only. No DB rows were changed by the audit.
- Runtime parser fixes were added for actual observed phrases:
  - Shoe structural damage: front/upper/side/back tear wording, `뜯어짐`, `튿어짐`, `뒷축깨짐`, `찢어진부분감안`, while excluding box/packaging/dustbag damage.
  - Shoe stain/discoloration: `신발끈 오염 살짝잇음`, `앞코 얼룩 조금`, `밑창 변색`, `황변이 생김`, `이염 사진 참고`, `이염, ...`, while excluding `이염도 아니고`, box-only discoloration, and `변색위험`.
  - Shoe hygiene: `악취`, `발냄새`, `담배 냄새`, `곰팡이`.
  - Bag discoloration/stain: inner bag/lining/internal stains, yellowing, tanning, water stains, color fading.
  - Bag damage: typo `벚겨짐`, handle/strap tear wording.
  - Clothing stain and structure: `커피 이염같다`, `목택이염`, `미세 이염 존재`, logo peeling, lining `튿어짐`.
- Added condition note -> UI chip mapping and comparison policy buckets for the new fashion notes:
  - `condition:shoe_upper_damage`
  - `condition:fashion_hygiene_warning`
  - `condition:bag_lining_damage`
  - `condition:bag_leather_damage`
  - `condition:bag_handle_worn`
  - `condition:bag_corner_worn`

## Sweep Result

Final command:

```bash
npx tsx scripts/report-fashion-condition-deepsweep.ts --scope=parsed --categories=shoe,clothing,bag --per-category-limit=10000 --page-size=500
```

Final output:

- rows scanned: 30,000
- findings: 1,497
- report-only disclaimers: 951
- suspected high-grade misses: 7
- learned signal without current note: 80

Earlier in this wave, before the later shoe/report refinements, the same 30,000-row sweep showed:

- suspected high-grade misses: 26
- learned signal without current note: 142

So the actionable high-grade miss count dropped 26 -> 7, and current-note gaps dropped 142 -> 80.

## Verification

Passed:

```bash
npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/condition-display.test.ts tests/condition-chip-policy.test.ts
```

## Deferred

- This is still a 30,000-row stratified historical sweep, not a full exhaustive pass across every fashion row in DB.
- Remaining 80 current-note gaps should be reviewed in a next wave with better sampling beyond the first report samples. Some are likely audit false positives or old SKU/product-type matching residues.
- A future AI-assisted condition classifier can be evaluated for ambiguous phrases, but this wave intentionally stayed deterministic and low-cost.
