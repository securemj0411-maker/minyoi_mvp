# Wave 68 — 팩 오픈 후 nav 크레딧 실시간 sync

> Status: **applied (code only).** DB write 0, DDL 0. autonomy 행동 (UX 버그 fix).

CLAUDE.md 6 필드 포맷.

## 0.1 pack open 후 AppNav credit 미갱신 fix

- 시간: 2026-05-14 KST
- 발견: 사용자 보고 — 팩 오픈하면 credit이 즉시 안 빠짐. 코드 추적:
  - `recommendation-workspace.tsx:466` `setTokens(openData.tokensRemaining)` 호출하지만 이건 workspace **자기 컴포넌트 state**만 갱신.
  - `app-nav.tsx:151` `AppNav`의 별도 `tokens` state는 mount + auth state change 시에만 `refreshCredits()` 호출.
  - 두 컴포넌트가 sibling이라 state 공유 안 됨 → AppNav의 token 표시가 stale.
- 변경:
  - `src/components/recommendation-workspace.tsx:466` pack open API 성공 후 `window.dispatchEvent(new CustomEvent("minyoi:credits-changed"))` 추가 (typeof window check 포함, SSR 안전).
  - `src/components/app-nav.tsx:197` 신규 useEffect: `window.addEventListener("minyoi:credits-changed", ...)` 등록 → 이벤트 발생 시 `refreshCredits()` 호출.
- 검증:
  - tsc clean
  - test:core 139/139 pass
  - 실제 UI 검증 필요: pack 오픈 후 nav token 즉시 감소 확인
- 위험: 매우 낮음. 단방향 이벤트 (workspace → nav). nav 외 다른 listener 없으면 side effect 0. SSR 안전 (typeof window check).
- 다음: 같은 패턴으로 다른 credit-변경 path (admin spend/refund 등) 있으면 동일 event 발행 추가 가능.
