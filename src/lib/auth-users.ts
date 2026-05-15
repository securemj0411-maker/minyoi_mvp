import type { User } from "@supabase/supabase-js";
import { hasAdminShadowFromRequest, hasAdminShadowFromCookies } from "@/lib/admin-shadow-mode";

// P1-13: admin email을 env에서 우선 읽고, 코드 하드코딩은 fallback으로만 유지.
// 운영 중 권한 추가/회수가 배포 없이 가능해진다 (ADMIN_EMAILS env 갱신 → Vercel 환경변수 핫스왑).
// 장기적으로는 mvp_admin_users 테이블 + supabase user metadata claim 기반으로 이전.
const LEGACY_ADMIN_EMAILS = new Set([
  "danshinadarina@gmail.com",
  "mj1270411@gmail.com",
  "mj12270411@gmail.com",
  "caulee1227@gmail.com",
]);

function envAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

// 외부에 노출되는 ADMIN_EMAILS은 env+legacy 합집합의 snapshot.
// (호환성을 위해 유지하지만 새 코드는 isAdminEmail() 헬퍼 사용을 권장.)
export const ADMIN_EMAILS: Set<string> = new Set([
  ...LEGACY_ADMIN_EMAILS,
  ...envAdminEmails(),
]);
export const ADMIN_DISPLAY_NAME = "운영자";

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  if (envAdminEmails().has(normalized)) return true;
  return LEGACY_ADMIN_EMAILS.has(normalized);
}

export function isAdminUser(user: Pick<User, "email"> | null | undefined): boolean {
  return isAdminEmail(user?.email);
}

// Wave 106: admin shadow mode 적용된 effective admin 여부. admin이라도 shadow cookie=1이면 false.
// API route에서 req 받으면 sync 검사 가능 (header cookie 직접 read).
export function isEffectiveAdmin(user: Pick<User, "email"> | null | undefined, req: Request): boolean {
  if (!isAdminUser(user)) return false;
  return !hasAdminShadowFromRequest(req);
}

// Server component (req 없을 때) — next/headers cookies() 사용. async.
export async function isEffectiveAdminAsync(user: Pick<User, "email"> | null | undefined): Promise<boolean> {
  if (!isAdminUser(user)) return false;
  return !(await hasAdminShadowFromCookies());
}

function cleanMetadataText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function displayNameForUser(user: Pick<User, "email" | "user_metadata"> | null | undefined): string {
  if (!user) return "";
  if (isAdminUser(user)) return ADMIN_DISPLAY_NAME;
  const metadata = user.user_metadata ?? {};
  const displayName =
    cleanMetadataText(metadata.nickname) ||
    cleanMetadataText(metadata.name) ||
    cleanMetadataText(metadata.full_name) ||
    cleanMetadataText(metadata.preferred_username);
  if (displayName) return displayName;
  return user.email?.split("@")[0] ?? "사용자";
}
