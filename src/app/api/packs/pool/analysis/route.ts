import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import {
  fetchLatestMarketStats,
  fetchLatestMarketStatsPerSource,
  fetchLatestMarketVelocity,
  fetchReferencePrices,
  fetchV7SiblingPresence,
  marketBasisForCandidate,
  velocityBasisForCandidate,
} from "@/lib/pack-open";
import type { RevealMarketBasis, RevealVelocityBasis } from "@/lib/pack-open";
import { normalizeMarketplaceSource } from "@/lib/marketplace-source";
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
  source: string | null;
  seller_source: string | null;
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
      `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,name,sku_id,sku_name&pid=eq.${pid}&limit=1`,
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

  // Wave launch-9 (audit CRITICAL #8): Promise.allSettled — 부분 실패 시 전체 null 차단.
  // 이전 Promise.all = 1개 fetch timeout 나도 6개 다 throw → analysis 전체 null → UI silent fail.
  // 사용자는 expected_profit 표시되는데 시세 근거 미확정 안내 없이 그대로 신뢰 → 손해 risk.
  // 이제 marketStats 만 필수, 나머지는 보조 (실패 시 그 항목만 null, 나머지 표시).
  const results = await Promise.allSettled([
    fetchLatestMarketStats([comparableKey]),           // 0: 필수
    fetchLatestMarketStatsPerSource([comparableKey]),  // 1: 보조 (source-aware 시세)
    fetchLatestMarketVelocity([comparableKey]),        // 2: 보조
    loadCategoryReadinessMap(),                         // 3: 보조 (velocity 가드용)
    fetchReferencePrices([comparableKey]),              // 4: 보조
    loadSkuListingFlow(raw?.sku_id ?? null),            // 5: 보조
    fetchV7SiblingPresence([comparableKey]),            // 6: 보조 (v3 clothing 가드)
  ]);

  function unwrap<T>(r: PromiseSettledResult<T>, slot: string, fallback: T): T {
    if (r.status === "fulfilled") return r.value;
    console.warn(`[pool/analysis] ${slot} failed`, {
      pid,
      err: r.reason instanceof Error ? r.reason.message : String(r.reason),
    });
    return fallback;
  }

  const marketStats = unwrap(results[0], "marketStats", new Map());
  const marketStatsPerSource = unwrap(results[1], "marketStatsPerSource", new Map());
  const velocityStats = unwrap(results[2], "velocityStats", new Map());
  const readinessMap = unwrap(results[3], "readinessMap", {} as Awaited<ReturnType<typeof loadCategoryReadinessMap>>);
  const referencePrices = unwrap(results[4], "referencePrices", new Map());
  const skuListingFlow = unwrap(results[5], "skuListingFlow", null);
  const v7SiblingPresence = unwrap(results[6], "v7SiblingPresence", new Map());
  const marketplaceSource = normalizeMarketplaceSource(raw?.source ?? raw?.seller_source);

  // marketStats (필수) 비었으면 marketBasis null — UI 가 "시세 확인중" 표시
  const marketBasis = comparableKey
    ? marketBasisForCandidate(
        comparableKey,
        raw?.sku_name ?? raw?.name ?? "",
        marketStats,
        parsed?.condition_class ?? null,
        referencePrices,
        v7SiblingPresence,
        {
          listingSource: marketplaceSource,
          perSourceMarketStats: marketStatsPerSource,
        },
      )
    : null;

  return {
    marketBasis,
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
