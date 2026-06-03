import { getMembershipPlan } from "@/lib/membership-plans";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type MembershipDecisionSource = "admin" | "telegram" | "auto";

export type MembershipApplicationRow = {
  id: number;
  user_ref: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  product_key: string | null;
  status: string;
  price_krw: number | null;
};

export type MembershipApprovalResult = {
  ok: boolean;
  activated: boolean;
  id: number;
  status: string | null;
  error?: string | null;
  authUserId?: string | null;
  userRef?: string | null;
  planEndAt?: string | null;
  priceKrw?: number | null;
  productKey?: string | null;
};

type ApprovalRpcRow = {
  ok: boolean;
  activated: boolean;
  application_id: number;
  status: string | null;
  error: string | null;
  user_ref: string | null;
  app_auth_user_id: string | null;
  plan_key: string | null;
  product_key: string | null;
  price_krw: number | null;
  current_period_end: string | null;
};

async function loadMembershipApplication(id: number): Promise<MembershipApplicationRow | null> {
  const res = await restFetch(
    `${tableUrl("mvp_membership_applications")}?select=id,user_ref,auth_user_id,email,display_name,product_key,status,price_krw&id=eq.${id}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as MembershipApplicationRow[];
  return rows[0] ?? null;
}

export async function approveMembershipApplication(
  id: number,
  decisionSource: MembershipDecisionSource,
  decidedByUserId: string | null = null,
): Promise<MembershipApprovalResult> {
  let application: MembershipApplicationRow | null = null;
  try {
    application = await loadMembershipApplication(id);
  } catch (err) {
    console.error("[membership-application-approval] lookup failed", { id, message: err instanceof Error ? err.message : String(err) });
    return { ok: false, activated: false, id, status: null, error: "lookup_failed" };
  }
  if (!application) return { ok: false, activated: false, id, status: null, error: "not_found" };

  const selectedPlan = getMembershipPlan(application.product_key);
  const priceKrw = Number(application.price_krw ?? selectedPlan.priceKrw);
  let res: Response;
  try {
    res = await restFetch(rpcUrl("approve_mvp_membership_application"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({
        p_application_id: id,
        p_decision_source: decisionSource,
        p_decided_by: decidedByUserId,
        p_plan_months: selectedPlan.months,
        p_price_krw: Number.isFinite(priceKrw) ? priceKrw : selectedPlan.priceKrw,
        p_product_key: selectedPlan.key,
      }),
    });
  } catch (err) {
    console.error("[membership-application-approval] rpc failed", { id, message: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240) });
    return { ok: false, activated: false, id, status: application.status, error: "rpc_failed" };
  }

  const rows = (await res.json()) as ApprovalRpcRow[];
  const row = rows[0];
  if (!row) return { ok: false, activated: false, id, status: application.status, error: "rpc_empty" };
  return {
    ok: row.ok,
    activated: row.activated,
    id: Number(row.application_id ?? id),
    status: row.status,
    error: row.error,
    authUserId: row.app_auth_user_id,
    userRef: row.user_ref,
    planEndAt: row.current_period_end,
    priceKrw: row.price_krw,
    productKey: row.product_key,
  };
}

export async function rejectMembershipApplication(
  id: number,
  decisionSource: MembershipDecisionSource,
  decidedByUserId: string | null = null,
  adminNote: string | null = null,
): Promise<MembershipApprovalResult> {
  const nowIso = new Date().toISOString();
  let res: Response;
  try {
    res = await restFetch(
      `${tableUrl("mvp_membership_applications")}?select=id,status,user_ref,auth_user_id,product_key,price_krw&id=eq.${id}&status=eq.pending`,
      {
        method: "PATCH",
        headers: serviceHeaders("return=representation"),
        body: jsonBody({
          status: "rejected",
          admin_note: adminNote || null,
          decided_by: decidedByUserId,
          decision_source: decisionSource,
          decided_at: nowIso,
          updated_at: nowIso,
        }),
      },
    );
  } catch (err) {
    console.error("[membership-application-approval] reject failed", { id, message: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240) });
    return { ok: false, activated: false, id, status: null, error: "reject_failed" };
  }

  const rows = (await res.json()) as Array<{
    id: number;
    status: string;
    user_ref: string | null;
    auth_user_id: string | null;
    product_key: string | null;
    price_krw: number | null;
  }>;
  const row = rows[0];
  if (!row) {
    const application = await loadMembershipApplication(id);
    return {
      ok: Boolean(application),
      activated: false,
      id,
      status: application?.status ?? null,
      error: application ? null : "not_found",
      authUserId: application?.auth_user_id ?? null,
      userRef: application?.user_ref ?? null,
      productKey: application?.product_key ?? null,
      priceKrw: application?.price_krw ?? null,
    };
  }

  return {
    ok: true,
    activated: false,
    id: row.id,
    status: row.status,
    authUserId: row.auth_user_id,
    userRef: row.user_ref,
    productKey: row.product_key,
    priceKrw: row.price_krw,
  };
}
