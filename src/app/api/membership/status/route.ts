import { NextResponse } from "next/server";
import { approveMembershipApplication } from "@/lib/membership-application-approval";
import { getMembershipPlan } from "@/lib/membership-plans";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { getProStatus, hasMembershipAccess } from "@/lib/user-subscription";
import {
  jsonBody,
  restFetch,
  serviceHeaders,
  tableUrl,
} from "@/lib/supabase-rest";
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

function adminNoteLine(message: string) {
  return `[${new Date().toISOString()}] ${message}`;
}

async function expireUnpaidReservationsForUser(authUserId: string) {
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - 7 * 60_000).toISOString();
  await restFetch(
    `${tableUrl("mvp_membership_applications")}?auth_user_id=eq.${authUserId}&status=eq.pending&deposit_confirmed_at=is.null&created_at=lt.${encodeURIComponent(cutoffIso)}&or=(application_kind.eq.new,application_kind.is.null)`,
    {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        status: "rejected",
        decided_at: nowIso,
        updated_at: nowIso,
        admin_note: adminNoteLine("auto_expired_unpaid_reservation_7m"),
      }),
    },
  ).catch((err) => {
    console.warn(
      "[membership/status] expire unpaid reservation failed",
      err instanceof Error ? err.message : String(err),
    );
  });
}

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  let membership = await getProStatus(auth.user, userRef);
  let isMember = hasMembershipAccess(membership);
  await expireUnpaidReservationsForUser(auth.user.id);

  const res = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,application_kind,product_key,price_krw,status,deposit_confirmed_at,scheduled_auto_approve_at,decided_at,created_at&auth_user_id=eq.${auth.user.id}&order=created_at.desc&limit=1`,
    { headers: serviceHeaders(), cache: "no-store" },
  ).catch(() => null);
  const rows = res?.ok ? ((await res.json()) as ApplicationStatusRow[]) : [];
  let application = rows[0] ?? null;
  if (
    application?.status === "pending" &&
    application.deposit_confirmed_at &&
    application.scheduled_auto_approve_at &&
    Date.parse(application.scheduled_auto_approve_at) <= Date.now()
  ) {
    const approval = await approveMembershipApplication(application.id, "auto", null);
    if (approval.ok && approval.activated) {
      membership = await getProStatus(auth.user, userRef);
      isMember = hasMembershipAccess(membership);
      application = {
        ...application,
        status: approval.status ?? "approved",
        decided_at: new Date().toISOString(),
      };
    } else if (!approval.ok) {
      console.warn("[membership/status] inline auto approve failed", {
        applicationId: application.id,
        error: approval.error ?? "unknown",
      });
    }
  }
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
  const activePlanActivatedAt =
    activeApplication?.decided_at ?? activeApplication?.created_at ?? null;
  const memberOfferExpiresAt = activePlanActivatedAt
    ? new Date(
        new Date(activePlanActivatedAt).getTime() + 60 * 60 * 1000,
      ).toISOString()
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
          activatedAt: activePlanActivatedAt,
          memberOfferExpiresAt,
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
