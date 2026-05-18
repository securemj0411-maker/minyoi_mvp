# 2026-05-18 Wave 218 — remove detail compare and pin modal footer

## Problem
- Clicking `상품 보기` from `/me` opened the recommendation modal and also auto-opened the developer-oriented detail comparison side panel.
- The `상세 비교` action was originally useful for debugging but is no longer appropriate for the user-facing flow.
- Wave 217 put actions in a card-level sticky block, but that was not a true modal footer and could feel like it disappeared while scrolling.

## Decision
- `상품 보기` no longer opens the detail comparison panel.
- The detail endpoint is still called in the background so `/me` lazy market analysis can populate the modal without showing the debug panel.
- `상세 비교` UI was removed from the modal and model guide panel.
- `공략 보기`, `번개장터 열기`, and inaccurate-info report now live in a modal-level footer outside the scroll container, so they stay visible at the bottom of the modal.

## Deferred
- The global footer currently uses the first reveal card when a pack-open result contains multiple cards. If multi-card modal actions become important, add an explicit selected-card affordance before widening the footer behavior.
