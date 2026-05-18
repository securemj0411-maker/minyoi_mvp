import type { NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser, requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";

type AdminAuthResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

// Wave 197 (2026-05-18): prod 에서 debug 라우트 차단 (defense in depth).
//   기존 가드 = requireSupabaseUser + isAdminUser (admin 만 통과). 충분하지만 admin 계정
//   탈취 시 debug 노출 위험. NODE_ENV=production 면 차단. 운영자 긴급 debug 시 env
//   ALLOW_DEBUG_IN_PRODUCTION=1 로 일시 우회.
function isDebugBlocked(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.ALLOW_DEBUG_IN_PRODUCTION === "1") return false;
  return true;
}

export async function requireDebugAdmin(req: NextRequest): Promise<AdminAuthResult> {
  if (isDebugBlocked()) {
    return { ok: false, error: "debug routes disabled in production", status: 404 };
  }
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return auth;
  if (!isAdminUser(auth.user)) return { ok: false, error: "admin only", status: 403 };
  return { ok: true };
}

export async function requireDebugAdminFromCookies(): Promise<AdminAuthResult> {
  if (isDebugBlocked()) {
    return { ok: false, error: "debug routes disabled in production", status: 404 };
  }
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok) return auth;
  if (!isAdminUser(auth.user)) return { ok: false, error: "admin only", status: 403 };
  return { ok: true };
}
