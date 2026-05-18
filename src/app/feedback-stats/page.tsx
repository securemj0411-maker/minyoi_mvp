import { notFound, redirect } from "next/navigation";
import { OPS_ADMIN_FEEDBACK_STATS_PATH } from "@/lib/admin-routes";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LegacyFeedbackStatsRedirectPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();
  redirect(OPS_ADMIN_FEEDBACK_STATS_PATH);
}
