# 2026-05-18 Wave 219 — report modal preserves reveal context

## Problem
- Clicking `토큰 +3 받기 · 부정확 정보 신고` closed the current recommendation modal before opening the report modal.
- That removed the product context while the user was deciding what to report.
- The original close was added to avoid z-index conflicts, but it produced a worse UX.

## Decision
- The report modal now opens above the existing recommendation modal without clearing `selectedItem`.
- The report overlay uses a higher z-index than `PackRevealModal`, so it can stack cleanly while preserving the underlying product context.

## Deferred
- After submission, the underlying footer still uses the old `alreadyReportedLoss` prop until `/me` is refreshed. If needed, update selected item feedback state immediately after a successful report.
