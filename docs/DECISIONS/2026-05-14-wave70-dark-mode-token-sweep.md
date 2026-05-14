# Wave 70 — 다크모드 일괄 fix (globals.css 토큰 override)

> Status: **applied (code only).** DB write 0, DDL 0. autonomy 행동 (UI 버그).

CLAUDE.md 6 필드 포맷.

## 0.1 dark mode hex 컬러 + brand 토큰 일괄 override

- 시간: 2026-05-14 KST
- 발견: 사용자 보고 — 다크모드 시 어떤 영역은 완전 흰색 노출. grep 결과:
  - `bg-[#fffbf4]`, `bg-[#fffaf1]`, `bg-[#f3eee5]` 등 cream/beige hex 컬러가 how-it-works/plans/legal-page/pack-shop에 30+ 곳 하드코딩, `dark:` variant 없음.
  - `var(--brand-accent-soft)`, `var(--brand-cream)` 등 CSS 토큰 89곳 사용. globals.css `.dark` 블록에 토큰 override 없어 light green 그대로.
  - 기존 globals.css에는 `bg-white`/`bg-zinc-*`/`text-zinc-*` 등 partial override만 있었음.
- 변경: `src/app/globals.css`
  - **`.dark` 블록 확장**: `--brand-accent-soft: #1f2a23`, `--brand-cream: #18181b`, `--brand-accent-strong: #d4ddd6`, `--brand-accent: #7a9580` 추가 → 89곳 일괄 다크 반영
  - **hex 컬러 dark override 추가**:
    - cream 배경 `#fffbf4`/`#fffaf1` 등 → `#18181b`
    - beige `#f3eee5`/`#f3ead8` 등 → `#27272a`
    - warm cream border `#ddd4c7`/`#e5dccf` 등 → `#3f3f46`
    - dark green/brown text → `#f4f4f5` / `#a1a1aa`
    - hover variant + divide border 동일 처리
- 검증:
  - tsc clean
  - test:core 139/139 pass
  - 실제 UI 검증 필요: 다크모드 토글 후 how-it-works/plans/legal/pack-shop 페이지 흰색 panel 사라지는지 확인
- 위험: 매우 낮음. 모든 변경은 `.dark` 스코프 안. light mode 무영향. light variant 없는 컴포넌트에만 적용.
- 다음: 사용자 다크모드 테스트 후 잔여 흰색 영역 신고 시 추가 hex 토큰 add.
