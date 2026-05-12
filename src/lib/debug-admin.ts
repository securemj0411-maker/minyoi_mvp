import type { NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUser, requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";

type AdminAuthResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function requireDebugAdmin(req: NextRequest): Promise<AdminAuthResult> {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return auth;
  if (!isAdminUser(auth.user)) return { ok: false, error: "admin only", status: 403 };
  return { ok: true };
}

export async function requireDebugAdminFromCookies(): Promise<AdminAuthResult> {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok) return auth;
  if (!isAdminUser(auth.user)) return { ok: false, error: "admin only", status: 403 };
  return { ok: true };
}
