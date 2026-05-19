// Wave 244 (2026-05-19): learning queue admin stats endpoint.
//
// GET /api/admin/learning-queue/stats
//
// 응답:
//   - coverage (오늘/이번 주/이번 달 ready 풀 AI 본 비율) — v_mvp_ai_l2_coverage_daily 기반
//   - costToday / costMonth (USD) — v_mvp_ai_l2_cost_daily
//   - callRateMonthly (line 데이터 — 월별 ai_seen_pct) — v_mvp_ai_l2_coverage_monthly
//   - queueSummary (pending/approved/rejected 개수, sku 별 top)

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CoverageRow = {
  day?: string;
  month?: string;
  category: string | null;
  total_ready: number;
  ai_seen: number;
  ai_seen_pct: number | null;
};

type CostRow = {
  day: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  try {
    const [dailyRes, monthlyRes, costRes, queueRes] = await Promise.all([
      restFetch(`${tableUrl("v_mvp_ai_l2_coverage_daily")}?select=day,category,total_ready,ai_seen,ai_seen_pct&order=day.desc&limit=500`, { headers: serviceHeaders() }),
      restFetch(`${tableUrl("v_mvp_ai_l2_coverage_monthly")}?select=month,category,total_ready,ai_seen,ai_seen_pct&order=month.desc&limit=120`, { headers: serviceHeaders() }),
      restFetch(`${tableUrl("v_mvp_ai_l2_cost_daily")}?select=day,model,calls,input_tokens,output_tokens,cost_usd&order=day.desc&limit=120`, { headers: serviceHeaders() }),
      restFetch(`${tableUrl("mvp_catalog_learning_queue")}?select=status,false_positive,frequency_count,sku_id`, { headers: serviceHeaders() }),
    ]);

    const dailyRows = (await dailyRes.json()) as CoverageRow[];
    const monthlyRows = (await monthlyRes.json()) as CoverageRow[];
    const costRows = (await costRes.json()) as CostRow[];
    const queueRows = (await queueRes.json()) as Array<{ status: string; false_positive: boolean; frequency_count: number; sku_id: string }>;

    // coverage aggregations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartIso = monthStart.toISOString().slice(0, 10);

    const agg = (rows: CoverageRow[], since: string) => {
      let total = 0;
      let seen = 0;
      for (const r of rows) {
        const key = (r.day ?? r.month ?? "").slice(0, 10);
        if (!key || key < since) continue;
        total += Number(r.total_ready ?? 0);
        seen += Number(r.ai_seen ?? 0);
      }
      const pct = total > 0 ? (seen / total) * 100 : null;
      return { totalReady: total, aiSeen: seen, aiSeenPct: pct };
    };

    const coverageToday = agg(dailyRows, todayIso);
    const coverageWeek = agg(dailyRows, weekStartIso);
    const coverageMonth = agg(dailyRows, monthStartIso);

    // cost aggregations
    let costToday = 0;
    let costMonth = 0;
    let costAll = 0;
    for (const r of costRows) {
      const day = (r.day ?? "").slice(0, 10);
      const c = Number(r.cost_usd ?? 0);
      costAll += c;
      if (day >= todayIso) costToday += c;
      if (day >= monthStartIso) costMonth += c;
    }

    // call rate monthly (line chart 데이터) — month 별 total/seen 합산.
    const byMonth = new Map<string, { totalReady: number; aiSeen: number }>();
    for (const r of monthlyRows) {
      const m = (r.month ?? "").slice(0, 7);
      if (!m) continue;
      const existing = byMonth.get(m) ?? { totalReady: 0, aiSeen: 0 };
      existing.totalReady += Number(r.total_ready ?? 0);
      existing.aiSeen += Number(r.ai_seen ?? 0);
      byMonth.set(m, existing);
    }
    const callRateMonthly = Array.from(byMonth.entries())
      .map(([month, v]) => ({
        month,
        totalReady: v.totalReady,
        aiSeen: v.aiSeen,
        aiSeenPct: v.totalReady > 0 ? (v.aiSeen / v.totalReady) * 100 : null,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // queue summary
    const queueByStatus: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    const skuFreq = new Map<string, number>();
    let falsePositiveCount = 0;
    for (const r of queueRows) {
      queueByStatus[r.status] = (queueByStatus[r.status] ?? 0) + 1;
      if (r.false_positive) falsePositiveCount += 1;
      skuFreq.set(r.sku_id, (skuFreq.get(r.sku_id) ?? 0) + Number(r.frequency_count ?? 0));
    }
    const topSkus = Array.from(skuFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sku_id, total]) => ({ sku_id, totalFrequency: total }));

    return NextResponse.json({
      coverage: {
        today: coverageToday,
        last7d: coverageWeek,
        thisMonth: coverageMonth,
      },
      cost: {
        today: Number(costToday.toFixed(4)),
        thisMonth: Number(costMonth.toFixed(4)),
        last30dAll: Number(costAll.toFixed(4)),
      },
      callRateMonthly,
      queue: {
        byStatus: queueByStatus,
        falsePositive: falsePositiveCount,
        topSkus,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/learning-queue/stats] error", err);
    return NextResponse.json({ error: "stats_failed" }, { status: 500 });
  }
}
