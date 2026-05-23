# launch-109 — cau 운영자 페이지: 세션 없으면 /login redirect (404 X)

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: cau admin layout 가드 — auth.ok 분리

## 배경

launch-108 의 cau layout 이 `if (!auth.ok || !isAdminUser) notFound()` — 세션 없는 사용자 (운영자 본인 다른 브라우저 / 시크릿) 가 cau URL 접속 → 404. 진입 불가.

사용자 요청: 세션 없으면 로그인 페이지로 보내달라.

## 변경 (`/cau../layout.tsx`)

```ts
if (!auth.ok) {
  const h = await headers();
  const currentPath = h.get("x-invoke-path") ?? h.get("x-next-pathname") ?? h.get("referer") ?? OPS_ADMIN_BASE_PATH;
  let nextPath = currentPath;
  try { if (currentPath.startsWith("http")) nextPath = new URL(currentPath).pathname; } catch { nextPath = OPS_ADMIN_BASE_PATH; }
  if (!nextPath.startsWith(OPS_ADMIN_BASE_PATH)) nextPath = OPS_ADMIN_BASE_PATH;
  redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}
if (!isAdminUser(auth.user)) notFound();
```

- 세션 없음 → `/login?next=<cau path>` (auth-form.tsx 가 이미 `?next=` 파라미터 처리, 로그인 후 자동 복귀)
- 로그인 했는데 admin 아님 → `notFound()` (URL obfuscation 유지)

## 영향

- 운영자 본인 시크릿/다른 브라우저 접속 → 로그인 → cau 복귀 가능
- 악의적 outsider 가 cau URL 발견 → 로그인 강요 → admin 아니라 404 (URL 구조는 보호)

## 검증

- 라이브 curl 확인: 307 redirect → `/login?next=%2Fcau...` → 200 OK.
- 모바일 캐시 우회는 시크릿 창 필요.
