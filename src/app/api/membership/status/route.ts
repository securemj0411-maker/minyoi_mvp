import { NextResponse } from "next/server";
import { getMembershipPlan } from "@/lib/membership-plans";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { getProStatus, hasMembershipAccess } from "@/lib/user-subscription";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplicationStatusRow = {
  id: number;
  application_kind: string | null;
  product_key: string | null;
  price_krw: number | null;
  status: string;
  deposit_confirmed_at: string | null;
  scheduled_auto_approve_at: string | null;
  decided_at: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const membership = await getProStatus(auth.user, userRef);
  const isMember = hasMembershipAccess(membership);

  const res = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,application_kind,product_key,price_krw,status,deposit_confirmed_at,scheduled_auto_approve_at,decided_at,created_at&auth_user_id=eq.${auth.user.id}&order=created_at.desc&limit=1`,
    { headers: serviceHeaders(), cache: "no-store" },
  ).catch(() => null);
  const rows = res?.ok ? ((await res.json()) as ApplicationStatusRow[]) : [];
  const application = rows[0] ?? null;
  const selectedPlan = application
    ? getMembershipPlan(application.product_key)
    : null;

  const activeRes = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,application_kind,product_key,price_krw,status,deposit_confirmed_at,scheduled_auto_approve_at,decided_at,created_at&auth_user_id=eq.${auth.user.id}&status=eq.approved&order=decided_at.desc.nullslast,created_at.desc&limit=1`,
    { headers: serviceHeaders(), cache: "no-store" },
  ).catch(() => null);
  const activeRows = activeRes?.ok
    ? ((await activeRes.json()) as ApplicationStatusRow[])
    : [];
  const activeApplication = activeRows[0] ?? null;
  const activePlan = activeApplication
    ? getMembershipPlan(activeApplication.product_key)
    : null;

  return NextResponse.json({
    ok: true,
    isMember,
    planEndAt: membership.proUntil ?? null,
    activePlan: activePlan
      ? {
          applicationId: activeApplication?.id ?? null,
          planKey: activePlan.key,
          planLabel: activePlan.label,
          months: activePlan.months,
          priceKrw: Number(activeApplication?.price_krw ?? activePlan.priceKrw),
          applicationKind: activeApplication?.application_kind ?? "new",
        }
      : null,
    application: application
      ? {
          id: application.id,
          status: application.status,
          applicationKind: application.application_kind ?? "new",
          planKey: selectedPlan?.key ?? application.product_key,
          planLabel: selectedPlan?.label ?? "멤버십",
          priceKrw: Number(
            application.price_krw ?? selectedPlan?.priceKrw ?? 0,
          ),
          depositConfirmedAt: application.deposit_confirmed_at,
          scheduledAutoApproveAt: application.scheduled_auto_approve_at,
          decidedAt: application.decided_at,
          createdAt: application.created_at,
        }
      : null,
  });
}
