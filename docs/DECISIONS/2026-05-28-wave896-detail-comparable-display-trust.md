# Wave 896 - Detail Comparable Display Trust

Date: 2026-05-28

## Decision

The detail page comparison list was technically using the same comparable key, but the visible list could still hurt trust:

- Old parsed rows with `condition_class = null` could pass into a same-condition list when enough known same-condition rows already existed.
- The UI then labelled those rows with the target listing's condition, making titles such as "SSS급" appear as "사용감 있는".
- High asking-price rows that were not representative of the daily market middle band could appear at the top because the UI sorts comparables by price descending.

## Changes

- In `/api/listings/[pid]/market-source`, if the target condition has at least 5 known same-condition comparison rows, unknown-condition rows are excluded from the display list.
- The comparable API now includes each comparable row's own `conditionClass`.
- Detail and easy-mode comparison rows render each row's own condition label instead of blindly reusing the target listing label.
- Display comparables are trimmed against the current daily market p25-p75 middle band when enough rows remain, falling back to IQR/MAD if the middle band is too sparse.

## Deferred

- The market-source debug API may eventually need a separate `debugComparables` field if operators want to inspect rows hidden from the user-facing display.
