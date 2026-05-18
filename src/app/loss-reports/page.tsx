import { notFound, redirect } from "next/navigation";
import { OPS_ADMIN_LOSS_REPORTS_PATH } from "@/lib/admin-routes";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LegacyLossReportsRedirectPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();
  redirect(OPS_ADMIN_LOSS_REPORTS_PATH);
}
