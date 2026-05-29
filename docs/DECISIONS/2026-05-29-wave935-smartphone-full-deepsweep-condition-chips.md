# Wave 935 — Smartphone Full Deep Sweep + Condition Chip Plumbing

Date: 2026-05-29

## Context

The previous smartphone sweep only covered currently ready/reserved candidate-pool exposure rows. That was useful for immediate leakage, but it was not a real language-pattern deep sweep because the sample size was too small.

User requirement:
- Run a real smartphone DB deep sweep over at least 1,000 rows.
- Do not patch only the one reported phrase.
- Make sure later UI condition chips can show concrete flaw phrases like back glass damage, hinge/internal display issues, black spots, etc.

## Decisions / Changes

- Extended `scripts/report-smartphone-condition-deepsweep.ts` with `--scope=parsed`.
  - `scope=parsed` paginates `mvp_listing_parsed` by category, so it can inspect thousands of historical smartphone rows instead of only ready/reserved pool rows.
  - The report now records stored condition, current reparse condition, current evidence hard signals, learned pattern tags, and analyzed row count.
- Ran a no-write full smartphone sweep:
  - `npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=smartphone --scope=parsed --limit=3000`
  - Analyzed rows: 3,000
  - Candidate defect rows: 233
  - Current-evidence missed rows: 6
  - Stored stale/non-flawed among candidates: 62
  - Reparsed non-flawed among candidates: 3
- Ran a no-write current pool sweep:
  - `npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=smartphone --scope=pool --limit=3000`
  - Analyzed rows: 818
  - Candidate defect rows: 19
  - Current-evidence missed rows: 0
  - Stored stale/non-flawed among candidates: 18
  - Reparsed non-flawed among candidates: 0
- Connected tech-device `condition_notes` to user-facing condition chips.
  - `device_body_damage` -> `뒷판/프레임 파손`
  - `foldable_hinge_damage` -> `힌지/내부액정 이상`
  - `display_defect` -> `액정/화면 이상`
  - other hard device notes now also map to short Korean chips.
- The same chip plumbing is used by:
  - `/api/packs/pool`
  - `/api/packs/me`
  - admin pool listing API
  - pack-open reveal card builder
- Fixed systematic parser gaps found by the sweep:
  - all hard tech evidence signals now map into pool-blocking `condition_notes`, not just display/body/hinge.
  - `touch_issue` now becomes `display_defect`.
  - `screen_replaced_or_repaired` now becomes `screen_replaced`.
  - `carrier_or_finance_risk` now becomes `sim_or_carrier_issue`.
  - camera, biometric, account lock, speaker/mic, water, parts-only, and unofficial-repair hard signals are also bridged.
- Reduced false positives found during the 3,000-row sweep:
  - `수리내역 없음` no longer triggers screen-repair hard signal.
  - `강화유리필름 교체` no longer triggers screen-repair hard signal.
  - `카메라도 문제 없음` no longer triggers camera hard signal.
  - `화면 깨진 곳 없음` no longer becomes display defect through the legacy visible-damage path.
- Strengthened real defect detection:
  - standalone `반점` on display/internal display is now a display defect signal.
  - foldable internal display `주름/반점` is now a hinge/internal-display hard signal, even if the seller also says touch still works.

## Verification

- `npx tsx --test tests/tech-device-condition-evidence.test.ts tests/condition-display.test.ts`
  - 29 pass, 0 fail
- `npm run build`
  - passed

## Deferred

- Historical rows with old parser versions still need cron/reparse/pool scoring to rewrite stored `condition_class` and `condition_notes`; this deploy fixes runtime parsing and UI chip plumbing.
- The remaining full-sweep misses are mostly broad learned-pattern false positives such as negated functional defect language. Keep them in the report as audit context, but do not turn them into pool-blocking logic without another category-specific review.
