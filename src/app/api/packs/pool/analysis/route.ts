import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import {
  fetchLatestMarketStats,
  fetchLatestMarketVelocity,
  fetchReferencePrices,
  fetchV7SiblingPresence,
  marketBasisForCandidate,
  velocityBasisForCandidate,
} from "@/lib/pack-open";
import type { RevealMarketBasis, RevealVelocityBasis } from "@/lib/pack-open";
import { loadCategoryReadinessMap } from "@/lib/category-readiness";
import { hasDetailAccess } from "@/lib/detail-access";
import { isAdminUser } from "@/lib/auth-users";
import { isBetaTesterAuthId } from "@/lib/beta-tester";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

// Wave 339b: /explore 카드 클릭 시 marketBasis/velocityBasis lazy-fill.
// pid 기반 — assertRevealAccess 우회 (사용자가 reveal 안 한 매물도 가능).
//
// /api/packs/reveals/detail의 loadRevealAnalysis 로직 차용 — 단 reveal 권한 검증 없음.
// /explore는 매물 풀 browsing이라 reveal 기록 X — pid만으로 분석 데이터 fetch.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawAnalysisRow = {
  pid: number;
  name: string | null;
  sku_id: string | null;
  sku_name: string | null;
};

type ParsedAnalysisRow = {
  pid: number;
  comparable_key: string | null;
  condition_class: string | null;
  parsed_json: Record<string, unknown> | null;
};

type Analysis = {
  marketBasis: RevealMarketBasis | null;
  velocityBasis: RevealVelocityBasis | null;
  skuListingFlow: { count24h: number; avgPerDay7d: number } | null;
  optionBaseAssumed: string[] | null;
};

async function loadJson<T>(url: string): Promise<T> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T;
}

async function loadSkuListingFlow(skuId: string | null): Promise<Analysis["skuListingFlow"]> {
  if (!skuId) return null;
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await loadJson<Array<{ created_at: string }>>(
    `${tableUrl("mvp_raw_listings")}?select=created_at&sku_id=eq.${encodeURIComponent(skuId)}&created_at=gte.${since7d}&limit=20000`,
  );
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const count24h = rows.filter((row) => new Date(row.created_at).getTime() >= cutoff24h).length;
  return {
    count24h,
    avgPerDay7d: Math.round((rows.length / 7) * 10) / 10,
  };
}

async function loadAnalysis(pid: number): Promise<Analysis> {
  const [rawRows, parsedRows] = await Promise.all([
    loadJson<RawAnalysisRow[]>(
      `${tableUrl("mvp_raw_listings")}?select=pid,name,sku_id,sku_name&pid=eq.${pid}&limit=1`,
    ),
    loadJson<ParsedAnalysisRow[]>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,condition_class,parsed_json&pid=eq.${pid}&limit=1`,
    ),
  ]);
  const raw = rawRows[0] ?? null;
  const parsed = parsedRows[0] ?? null;
  const comparableKey = parsed?.comparable_key ?? null;
  const optionBaseAssumedRaw = parsed?.parsed_json?.option_base_assumed;
  const optionBaseAssumed = Array.isArray(optionBaseAssumedRaw) ? (optionBaseAssumedRaw as string[]) : null;

  if (!comparableKey) {
    return {
      marketBasis: null,
      velocityBasis: null,
      skuListingFlow: await loadSkuListingFlow(raw?.sku_id ?? null),
      optionBaseAssumed,
    };
  }

  const [marketStats, velocityStats, readinessMap, referencePrices, skuListingFlow, v7SiblingPresence] = await Promise.all([
    fetchLatestMarketStats([comparableKey]),
    fetchLatestMarketVelocity([comparableKey]),
    loadCategoryReadinessMap(),
    fetchReferencePrices([comparableKey]),
    loadSkuListingFlow(raw?.sku_id ?? null),
    // Wave 252.A real (2026-05-20): v3 clothing key + v7 sibling 존재 시 mixed-pool median 차단.
    fetchV7SiblingPresence([comparableKey]),
  ]);

  return {
    marketBasis: marketBasisForCandidate(
      comparableKey,
      raw?.sku_name ?? raw?.name ?? "",
      marketStats,
      parsed?.condition_class ?? null,
      referencePrices,
      v7SiblingPresence,
    ),
    velocityBasis: velocityBasisForCandidate(comparableKey, velocityStats, readinessMap),
    skuListingFlow,
    optionBaseAssumed,
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireSupabaseUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const url = new URL(req.url);
    const pidStr = url.searchParams.get("pid");
    const pid = Number(pidStr);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json({ error: "invalid pid" }, { status: 400 });
    }
    const userRef = userRefForAuthUser(auth.user.id);
    const unlimitedAccess = isAdminUser(auth.user) || (await isBetaTesterAuthId(auth.user.id));
    if (!(await hasDetailAccess({ user: auth.user, userRef, pid, unlimited: unlimitedAccess }))) {
      return NextResponse.json({ error: "detail_access_required" }, { status: 403 });
    }

    const analysis = await loadAnalysis(pid);
    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("pool_analysis failed", { err: message });
    return NextResponse.json({ error: "analysis_load_failed" }, { status: 500 });
  }
}
