# Wave 954 — Condition Chip Visibility And Comparison Policy

## Context

User feedback: condition chips are still too quiet visually, and the next real question is whether market comparison should require identical chips or chip bundles instead of only the current condition tier/class.

The worry is valid:
- If chips are only decorative, users may miss important condition evidence such as back-glass damage, display issues, stains, missing box, one-side earbud, or low battery.
- If comparison uses exact chip equality too aggressively, many SKUs become sample-starved and prices become less stable.
- Regex-only parsing has a "chicken and egg" risk: broad learned phrases can find real defects, but can also misread negations and product specs such as "흠집 없음", "액정 불량 없습니다", "화면 해상도", or "사진상 필름입니다".

## No-Write DB Sweep Snapshot

Re-ran the existing no-write deepsweep reports against live DB data.

Parsed historical rows:
- smartphone parsed 3,000 rows: candidate 214, missedByCurrentEvidence 11.
- tablet parsed 3,000 rows: candidate 87, missedByCurrentEvidence 10.
- smartwatch parsed 3,000 rows: candidate 47, missedByCurrentEvidence 9.
- laptop parsed 3,000 rows: candidate 60, missedByCurrentEvidence 18.

Ready/reserved exposed pool:
- smartphone pool 1,000 rows: candidate 1, missedByCurrentEvidence 1.
  - The remaining sample was a negation-like case: "화면에 깨진거 처럼 보이는건 필름입니다 / 상태 좋습니다".
- tablet pool 190 rows: 0 candidates.
- smartwatch pool 276 rows: 0 candidates.
- laptop pool 32 rows: 0 candidates.

Fashion ready/reserved pool:
- 1,762 rows checked.
- findingRows 29.
- suspiciousHighGradeRows 0.
- learnedWithoutCurrentNoteRows 0.
- Remaining findings are mostly report-only disclaimers or stain/discoloration rows already represented by current parser output.

## Decision

1. Make the visible condition chips stronger now.
   - Tier badges and note chips are now larger, bolder, and have rings/shadows so they read as real deal evidence rather than small metadata.

2. Do not switch comparison to exact chip-set equality yet.
   - Exact chip matching is too brittle for current sample density.
   - A listing with `A급 + 박스 포함` should not lose all comparison data just because the market has enough `A급` rows but not enough identical chip sets.

3. Use a hierarchical comparison policy.
   - Primary axis: product identity/comparable key.
   - Primary condition price axis: `condition_class` / fashion `condition_tier`.
   - Hard-separation chips: defects that materially change market price or purchase safety must split or block the row.
     - Examples: display defect, back/body damage, hinge damage, camera lens damage, touch/Face ID/charging/audio faults, one-side earbud, parts-only, lock/carrier/payment risk, water damage.
   - Soft-adjustment chips: keep in the broader condition lane unless sample density is high enough, but expose them and use them for caution/penalty.
     - Examples: stains, discoloration, pilling, minor scratches, missing box, low battery, missing accessories.
   - Positive chips: can support premium/clean confidence, but should not split the lane unless enough samples exist.
     - Examples: KREAM/Soldout proof, store/official purchase, full set, unworn, high battery.

4. AI should be used as a second-pass ambiguity judge, not as the primary classifier.
   - Deterministic parser remains cheaper, faster, and auditable for clear phrases.
   - AI is appropriate for negation, contrast, image-reference wording, and spec boilerplate cases where regex cannot safely know whether the text is a defect or a denial of a defect.

## Deferred

- Implementing chip-aware market price calculation is deferred until the grouping policy is encoded with minimum sample thresholds.
- A next wave should add an ambiguity-audit queue:
  - rows where learned broad tags fire but current parser does not;
  - rows where defect words appear near negation markers;
  - rows where specs or copied catalog descriptions cause false positives;
  - rows where chips conflict with the final tier shown to users.

## Verification

Commands run:

```bash
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=smartphone --scope=parsed --limit=3000
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=tablet --scope=parsed --limit=3000
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=smartwatch --scope=parsed --limit=3000
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=laptop --scope=parsed --limit=3000
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=smartphone --scope=pool --limit=3000 --pool-statuses=ready,reserved
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=tablet --scope=pool --limit=3000 --pool-statuses=ready,reserved
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=smartwatch --scope=pool --limit=3000 --pool-statuses=ready,reserved
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=laptop --scope=pool --limit=3000 --pool-statuses=ready,reserved
npx tsx scripts/report-fashion-condition-deepsweep.ts
```
