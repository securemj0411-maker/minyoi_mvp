# Wave 975 — Earphone Case Exclusion False Positive

Date: 2026-05-30 KST

## Context

Follow-up review of `suspiciousHighGradeRows` showed several clean earphone rows with `condition:earphone_missing_parts`.

Most were legitimate soft warnings:

- over-ear headphone `단품`
- AirPods Max `풀박스` but charging cable/charger missing

However, AirPods Pro rows with this description were false positives:

- `케이스 상태는 생활기스를 제외하고 하자없이 아주 좋습니다`

The parser treated `케이스 ... 제외` as missing case/accessory, even though the sentence meant “except for minor scratches on the case”.

## Decision

Narrow the earphone missing-parts pattern:

- keep broad missing-part matching for `박스`, `케이블`, `이어팁`, `충전기`, `파우치`
- handle `케이스` separately
- only treat `케이스` as missing when the text says case is absent/lost/excluded directly
- do not treat “case condition excluding scratches” as missing parts

## Verification

Added regression test:

- `케이스 상태는 생활기스를 제외하고 하자없이 아주 좋습니다`
- expected: no `missing_parts`

Existing positive cases still pass:

- `케이스만 없는 풀박스`
- `본체 케이스 잃어버려서 없어요`
- full-size headphone `단품`

## Deferred

Existing stored parsed rows need a later score/reparse pass to clear the stale warning chip in DB.
