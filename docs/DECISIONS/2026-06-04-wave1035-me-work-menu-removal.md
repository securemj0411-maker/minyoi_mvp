# Wave 1035 — Me Work Menu Removal

## Context

User reviewed the `/me` desktop sidebar screenshot and decided the "작업 메뉴" area is not pulling its weight. Current priority is to keep the product feed as the default surface.

## Decision

- Remove the visible `/me` work menu/sidebar from the signed-in dashboard.
- Keep the underlying direct view code for deferred surfaces:
  - `hotdeal-alerts`
  - `guides`
  - admin-only operational views
- Keep `/me` defaulting to the product feed.

## Changes

- Removed sidebar collapse state, localStorage key, menu buttons, and subscription fetch used only for menu gating from `me-dashboard-client.tsx`.
- Simplified loading and signed-in layouts to one full-width content column.
- Added a contract test that prevents the work menu/sidebar from returning while confirming `HotdealAlertsView` still exists for direct reuse.

## Deferred

- Decide later whether `guides` and `hotdeal-alerts` need new entry points inside another surface.
- Direct `?view=` access remains available for now because the code may be reused later.
