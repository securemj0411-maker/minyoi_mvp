# Wave 936 - Earphone Condition Deep Sweep

Date: 2026-05-29

## Decision

Continue the condition parser sweep after the smartphone pass, starting with earphones because the DB sweep showed many real hard signals were stored only in `earphone_condition_*` evidence and did not affect `condition_class` or user-facing chips.

## Implemented

- Made `scripts/report-smartphone-condition-deepsweep.ts` usable for large parsed-category sweeps by removing the heavy `parsed_json` select, adding `--page-size`, and making parsed ordering optional.
- Connected earphone hard evidence to `condition_notes` so `parseListingOptions` now lowers hard cases to `flawed`:
  - one-side unit / missing side
  - charging case or protective case only
  - audio output issue
  - ANC / transparency issue
  - mic issue
  - pairing / connection issue
  - charging / battery issue
  - physical damage
- Added user-facing chip mappings for earphone notes:
  - `소리 이상`
  - `노캔/주변음 이상`
  - `마이크 이상`
  - `페어링/연결 이상`
  - `충전/배터리 이상`
  - `한쪽 유닛/분실`
  - `케이스/부품 단품`
  - `구성품 누락`
  - `오염 확인`
- Tightened false-positive handling from sampled Korean listing text:
  - `지지직 없습니다`, `지지직 거림x`, `전혀 그런 문제없습니다`
  - `노캔은 안됨` as no-ANC variant, not ANC failure
  - `화이트/스모크화이트 노이즈캔슬링` as color + feature, not white-noise defect
  - `기능문제 없습니다`, `연결 문제도 없습니다`, `관련 문제 일체 없음`
  - `충전기 포함/x` and cross-sentence `충전 케이스 ... 음질 문제 없음`
  - `파손 우려로 직거래`, `떨어뜨림 일절 없음`
  - `오른쪽 밑 찍힘` not one-side missing
  - `케이스티파이 포함`, `본체 + 보관 케이스` not case-only listing
  - `케이스만 없는 풀박스` not case-only listing

## Sweep Result

Command:

```bash
npx tsx scripts/report-smartphone-condition-deepsweep.ts --category=earphone --scope=parsed --limit=3000 --page-size=250
```

Before this wave, the same sweep shape showed:

- `candidateRows`: 115
- `missedByCurrentEvidence`: 2
- `storedConditionStillNormal`: 87
- `reparsedConditionStillNormal`: 86

After this wave:

- `analyzedRows`: 3000
- `candidateRows`: 42
- `missedByCurrentEvidence`: 0
- `storedConditionStillNormal`: 22
- `reparsedConditionStillNormal`: 0

The important result is `reparsedConditionStillNormal: 0`: current hard earphone evidence now maps to a hard condition class on reparse instead of staying normal/clean.

## Verification

- `npx tsx --test tests/core-rules.test.ts tests/tech-device-condition-evidence.test.ts tests/earphone-condition-evidence.test.ts tests/condition-display.test.ts`
  - 185 pass, 0 fail
- `npm run build`
  - passed

## Deferred

- Tablet and smartwatch parsed sweeps still show a small residual gap, mostly generic learned-pattern rows and source wording drift. They should be handled as the next category-specific wave instead of folding more broad generic regex into this earphone wave.
- This wave does not backfill existing `mvp_listing_parsed` rows. Production cron/reparse must naturally refresh rows, or a separate scoped backfill can be run if immediate cleanup is needed.
