# Wave 938 — Camera Lens Damage Condition Split

Date: 2026-05-29

## Context

Wave 937 left camera protective-glass/lens damage as a deferred issue. Smartphone deepsweep showed that lens/glass wording was being mixed into generic `camera_issue`, `repair_or_defect_signal`, or body damage. This made user-facing chips too vague and let some "카메라 렌즈 깨짐" rows avoid the explicit condition label.

The goal was to avoid a one-off block and split the repeated marketplace language:

- Hard damage: `카메라 렌즈 깨짐`, `카메라 커버 크게 흠집`, `카메라 멍 2개`
- Non-damage/false positive: `카메라 기스/파손 없습니다`, `카메라 이상 X`, `카메라보호필름`, `카메라섬 주변 생활기스`

## Changes

- Added tech-device signal `camera_lens_or_glass_damage`.
- Added parser note `camera_lens_damage` and bumped parser version to `option-parser-v65`.
- Added user-facing chip mapping: `카메라 렌즈 손상`.
- Added `camera_lens_damage` to pool-block condition notes because lens/glass cracks are clear user-loss candidates, not a simple resale discount.
- Added first-pass `classifyListing` damaged detection for camera lens/glass damage, with false-positive guards for protective film and clean camera wording.
- Tightened generic cosmetic wear negation so "기스 및 파손 없습니다" does not become `cosmetic_wear`, while "기스 없음 찍힘 있음" still stays worn.
- Updated the no-write deepsweep reporter so the broad learner matches the refined runtime boundary.

## Verification

- `npx tsx --test tests/tech-device-condition-evidence.test.ts tests/condition-display.test.ts tests/core-rules.test.ts`
  - 166 pass, 0 fail
- `npm run build`
  - passed
- Smartphone parsed deepsweep after final changes:
  - analyzedRows: 3,000
  - camera lens broad tag: 13 before → 1 after
  - remaining camera lens sample is now also caught by runtime `current:camera_lens_or_glass_damage`

## Deferred

- "카메라 링 벗겨짐" remains intentionally not mapped to lens damage unless paired with strong crack/deep damage wording. It is more likely cosmetic ring wear than lens/glass failure.
- Camera-category body/lens package policy stays separate; this wave only affects tech-device condition gates for smartphone/tablet/smartwatch text.
