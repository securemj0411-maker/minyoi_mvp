# Wave 107 — /me 페이지 sidebar collapse toggle

> Status: **applied (code).** owner 요청 — 좌측 작업메뉴를 접고 펼치게. 접으면 main content (AI 추천 등) wider 표시.

CLAUDE.md 6 필드 포맷.

## 1. Sidebar collapse toggle

- 시간: 2026-05-15
- 발견: owner 요청 — desktop /me 페이지에서 좌측 작업메뉴 sidebar를 접고 펼치는 토글. 접으면 main content가 가운데로 넓혀짐 (gmail/slack 같은 UX).
- 변경: **[mvp/src/components/me-dashboard-client.tsx](mvp/src/components/me-dashboard-client.tsx)**
  - state 추가: `sidebarCollapsed` + localStorage 영속 (`me_sidebar_collapsed=1`)
  - `toggleSidebar()` — toggle + localStorage 갱신
  - grid template col 동적: collapsed `44px_1fr` / expanded `220px_1fr` (transition 200ms)
  - aside 내부:
    - desktop only collapse 버튼 추가 (`›` / `‹` 아이콘)
    - "My Dashboard" 헤더 + 메뉴 list — collapsed 시 `lg:hidden`
    - aside 자체는 그대로 유지 (44px width = 토글 버튼만 보임)
  - mobile은 영향 0 (sidebar가 sticky chip bar라 collapse 무관)
- 검증:
  - `npx tsc --noEmit` exit 0
  - `npx eslint --max-warnings=0` exit 0
- 위험: 매우 낮음. desktop UI 변경만, server-side 영향 0.
- 다음:
  - 접힌 상태에서도 메뉴 아이콘 표시 (현재는 토글만) — UX 보강 시 별도 wave.
  - keyboard shortcut (예: `[` / `]`) 추가 검토.
