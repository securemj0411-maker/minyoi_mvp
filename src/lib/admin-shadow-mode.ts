// Wave 106 (2026-05-15): admin이 일반인으로 가장하는 shadow mode.
// 운영자가 본인 권한 무력화하고 일반 회원 경험(rate limit + 플랜 게이팅 + 무한 크레딧 X) 테스트.
//
// 메커니즘: cookie `admin_shadow=1`. client에서 toggle, server에서 검사.
// localStorage는 server-side에서 못 읽으므로 cookie 필수.

const COOKIE_NAME = "admin_shadow";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30일

// ===== Client (브라우저) =====

export function hasAdminShadowClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim() === `${COOKIE_NAME}=1`);
}

export function setAdminShadowClient(on: boolean): void {
  if (typeof document === "undefined") return;
  if (on) {
    document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } else {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

// ===== Server (Request header / Next cookies) =====

export function hasAdminShadowFromRequest(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie") ?? "";
  return cookieHeader.split(";").some((c) => c.trim() === `${COOKIE_NAME}=1`);
}

export async function hasAdminShadowFromCookies(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "1";
}
