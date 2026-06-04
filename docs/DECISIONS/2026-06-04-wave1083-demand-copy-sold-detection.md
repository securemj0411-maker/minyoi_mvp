# 2026-06-04 Wave 1083 - Demand Copy Uses Sold Detection

## Decision
- The detail card previously said `수요 활발`, but the current signal does not use likes, chat count, or wish count.
- The signal is derived from sold-detection velocity (`sold_7d_count`) relative to active market samples.
- To avoid implying unsupported chat/interest telemetry, display this as recent sold detection instead of generic demand.

## Implemented
- Changed the market activity value copy from `수요 활발/보통/약함` to `최근 판매감지 활발/보통/적음`.
- Changed the sub copy from `최근 거래 N건` to `최근 판매감지 N건`.

## Deferred
- The visible comparable list can still show only active listings when active rows occupy the available proof slots.
- A later UX pass can reserve one or two proof slots for sold-confirmed rows when velocity says recent sold rows exist.
