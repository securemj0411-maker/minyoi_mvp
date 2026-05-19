// Wave 342: /explore 운영자 모니터 — 비밀 path 안에 박음 (Wave 340 정정).
// URL obfuscation + admin auth 이중 보호. 비admin은 notFound() → URL 존재 자체 노출 X.

import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import ExploreMonitorClient from "./explore-monitor-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ExploreMonitorPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) {
    notFound();
  }
  return <ExploreMonitorClient />;
}
