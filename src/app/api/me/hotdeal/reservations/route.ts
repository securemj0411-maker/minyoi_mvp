// Wave 93b: 사용자 활성 핫딜 reservation 목록 (pending).

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userRef = userRefForAuthUser(auth.user.id);
  const now = new Date().toISOString();

  // 1. pending reservation 가져오기.
  const resvRes = await restFetch(
    `${tableUrl("mvp_hotdeal_reservations")}?select=id,pid,attempt_no,sent_at,expires_at,opened_at,decision&user_ref=eq.${encodeURIComponent(userRef)}&decision=in.(pending,opened)&expires_at=gte.${encodeURIComponent(now)}&order=sent_at.desc&limit=50`,
    { headers: serviceHeaders() },
  );
  const reservations = (await resvRes.json()) as Array<{
    id: number;
    pid: number;
    attempt_no: number;
    sent_at: string;
    expires_at: string;
    opened_at: string | null;
    decision: string;
  }>;

  if (reservations.length === 0) {
    return NextResponse.json({ reservations: [] });
  }

  // 2. listing info join.
  const pids = reservations.map((r) => r.pid);
  const [listingRes, queueRes] = await Promise.all([
    restFetch(
      `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median,sku_name,thumbnail_url&pid=in.(${pids.join(",")})`,
      { headers: serviceHeaders() },
    ),
    restFetch(
      `${tableUrl("mvp_hotdeal_queue")}?select=pid,profit_amount,profit_margin,band&pid=in.(${pids.join(",")})`,
      { headers: serviceHeaders() },
    ),
  ]);
  const listings = new Map(((await listingRes.json()) as Array<Record<string, unknown>>).map((r) => [Number(r.pid), r]));
  const queueByPid = new Map(((await queueRes.json()) as Array<Record<string, unknown>>).map((r) => [Number(r.pid), r]));

  return NextResponse.json({
    reservations: reservations.map((r) => {
      const l = listings.get(r.pid);
      const q = queueByPid.get(r.pid);
      const opened = r.decision === "opened" || r.decision === "purchased";
      // pre-open: 매물 정보 (제목/이미지/매입가/시세/번장 링크) 숨김. 차익 정도만 teaser.
      // network tab에서 봐도 정보 안 새도록 서버에서 차단.
      return {
        id: r.id,
        pid: r.pid,
        attemptNo: r.attempt_no,
        sentAt: r.sent_at,
        expiresAt: r.expires_at,
        openedAt: r.opened_at,
        decision: r.decision,
        listing: opened
          ? {
              name: (l?.name as string | undefined) ?? "(no title)",
              skuName: (l?.sku_name as string | null) ?? null,
              price: Number(l?.price ?? 0),
              skuMedian: Number(l?.sku_median ?? 0),
              thumbnailUrl: (l?.thumbnail_url as string | null) ?? null,
              bunjangUrl: `https://m.bunjang.co.kr/products/${r.pid}`,
            }
          : null,
        deal: {
          profitAmount: Number(q?.profit_amount ?? 0),
          profitMargin: Number(q?.profit_margin ?? 0),
          band: q?.band ?? null,
        },
      };
    }),
  });
}
