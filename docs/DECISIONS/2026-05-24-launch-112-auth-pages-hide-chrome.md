# launch-112 — /login·/signup·/auth/* 페이지 nav + footer hide

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: AppNav + AppFooter 라우트 분기 — focused 단일 액션

## 배경

사용자 정정: "로그인 화면에서 위에 네비게이션 없이 로그인만 할 수 있게 하는 게 낫지 않나? 보통 다른 사이트도 그러지 않음?"

표준 패턴 — 로그인/회원가입 화면에서는 nav 메뉴 / footer 다 hide 해서 사용자가 로그인 외 다른 액션으로 새지 않게 focused 한 화면.

## 변경

### `src/components/app-nav.tsx`
```ts
if (pathname === "/login" || pathname === "/signup" || pathname?.startsWith("/auth/")) {
  return null;
}
```

### `src/components/app-footer.tsx`
동일 분기 추가.

cau admin path 분기 (launch-101/102) 와 같은 패턴 — pathname 기반 hide.

## 영향

- 로그인 / 회원가입 / 콜백 페이지에서 nav + footer 안 보임.
- 사용자가 로그인 form 만 보이는 focused 화면 → conversion ↑.
