import { NextResponse } from "next/server";
import {
  getMembershipPlan,
  UPSELL_PLANS_FROM_1MO,
  UPSELL_PLANS_FROM_3MO,
} from "@/lib/membership-plans";
import { signMembershipOffer } from "@/lib/membership-offer-token";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function upsellPlansForBase(productKey: string | null | undefined) {
  const basePlan = getMembershipPlan(productKey);
  if (basePlan.key === "limited_300_1mo") return UPSELL_PLANS_FROM_1MO;
  if (basePlan.key === "limited_300_3mo") return UPSELL_PLANS_FROM_3MO;
  return [];
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as {
    baseProductKey?: string;
  };
  const basePlan = getMembershipPlan(body.baseProductKey);
  if (basePlan.isUpsell) {
    return NextResponse.json({ error: "invalid_base_plan" }, { status: 400 });
  }

  const offerPlans = upsellPlansForBase(basePlan.key);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  return NextResponse.json({
    ok: true,
    baseProductKey: basePlan.key,
    expiresAt,
    offers: offerPlans.map((plan) => ({
      productKey: plan.key,
      token: signMembershipOffer({
        authUserId: auth.user.id,
        intent: "new",
        baseProductKey: basePlan.key,
        offerProductKey: plan.key,
        expiresAt,
      }),
    })),
  });
}
