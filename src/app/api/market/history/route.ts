// 2026-05-15: 시세 history (일별 active/sold median 누적). 카드 reveal 모달 chart용.
// auth 없음 — comparable_key 알아야 호출 가능. read-only.

import { NextResponse, type NextRequest } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DAYS = 90;
const DEFAULT_DAYS = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ck = url.searchParams.get("ck")?.trim();
  if (!ck) return NextResponse.json({ error: "missing_ck" }, { status: 400 });
  const days = Math.max(1, Math.min(MAX_DAYS, Number(url.searchParams.get("days") ?? String(DEFAULT_DAYS)) || DEFAULT_DAYS));

  try {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const res = await restFetch(
      `${tableUrl("mvp_market_price_daily")}?select=date,active_median_price,sold_median_price,blended_median_price,active_sample_count,sold_sample_count,confidence&comparable_key=eq.${encodeURIComponent(ck)}&date=gte.${since}&order=date.asc&limit=200`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "history_fetch_failed" }, { status: 500 });
    }
    const rows = (await res.json()) as Array<{
      date: string;
      active_median_price: number | null;
      sold_median_price: number | null;
      blended_median_price: number | null;
      active_sample_count: number | null;
      sold_sample_count: number | null;
      confidence: string | null;
    }>;
    return NextResponse.json({
      comparableKey: ck,
      points: rows.map((r) => ({
        date: r.date,
        active: r.active_median_price ?? null,
        sold: r.sold_median_price ?? null,
        blended: r.blended_median_price ?? null,
        activeCount: Number(r.active_sample_count ?? 0),
        soldCount: Number(r.sold_sample_count ?? 0),
        confidence: r.confidence ?? "low",
      })),
    });
  } catch (err) {
    console.error("[market/history] error", err);
    return NextResponse.json({ error: "history_fetch_failed" }, { status: 500 });
  }
}
