import { NextResponse } from "next/server";
import { loadCategoryReadinessMap } from "@/lib/category-readiness";
import {
  fetchLatestMarketStats,
  fetchLatestMarketVelocity,
  fetchReferencePrices,
  loadRevealListingDetail,
  marketBasisForCandidate,
  velocityBasisForCandidate,
} from "@/lib/pack-open";
import type { RevealMarketBasis, RevealVelocityBasis } from "@/lib/pack-open";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_USER_REF = 64;

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

type RevealAnalysis = {
  marketBasis: RevealMarketBasis | null;
  velocityBasis: RevealVelocityBasis | null;
  skuListingFlow: { count24h: number; avgPerDay7d: number } | null;
  optionBaseAssumed: string[] | null;
};

async function loadJson<T>(url: string): Promise<T> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T;
}

async function loadSkuListingFlow(skuId: string | null): Promise<RevealAnalysis["skuListingFlow"]> {
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

async function loadRevealAnalysis(pid: number): Promise<RevealAnalysis | null> {
  const [rawRows, parsedRows] = await Promise.all([
    loadJson<RawAnalysisRow[]>(
      `${tableUrl("mvp_raw_listings")}?select=pid,name,sku_id,sku_name&pid=eq.${pid}&limit=1`,
    ),
    loadJson<ParsedAnalysisRow[]>(
      `${tableUrl("mvp_parsed_listings")}?select=pid,comparable_key,condition_class,parsed_json&pid=eq.${pid}&limit=1`,
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

  const [marketStats, velocityStats, readinessMap, referencePrices, skuListingFlow] = await Promise.all([
    fetchLatestMarketStats([comparableKey]),
    fetchLatestMarketVelocity([comparableKey]),
    loadCategoryReadinessMap(),
    fetchReferencePrices([comparableKey]),
    loadSkuListingFlow(raw?.sku_id ?? null),
  ]);

  return {
    marketBasis: marketBasisForCandidate(
      comparableKey,
      raw?.sku_name ?? raw?.name ?? "",
      marketStats,
      parsed?.condition_class ?? null,
      referencePrices,
    ),
    velocityBasis: velocityBasisForCandidate(comparableKey, velocityStats, readinessMap),
    skuListingFlow,
    optionBaseAssumed,
  };
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const userRefRaw = req.headers.get("x-user-ref") ?? payload.userRef;
  const userRef = typeof userRefRaw === "string" ? userRefRaw.trim().slice(0, MAX_USER_REF) : "";
  const pid = Number(payload.pid);

  if (!userRef) return NextResponse.json({ error: "missing user ref" }, { status: 400 });
  if (userRef !== userRefForAuthUser(auth.user.id)) {
    return NextResponse.json({ error: "user ref does not match session" }, { status: 403 });
  }
  if (!Number.isFinite(pid)) return NextResponse.json({ error: "invalid pid" }, { status: 400 });

  try {
    const detail = await loadRevealListingDetail({ userRef, pid });
    const analysis = await loadRevealAnalysis(pid).catch((err) => {
      console.error("reveal_detail analysis failed (non-fatal)", {
        err: err instanceof Error ? err.message : String(err),
        userRef,
        pid,
      });
      return null;
    });
    return NextResponse.json({
      detail,
      analysis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const notFound = message.includes("not found");
    console.error("reveal_detail failed", { err: message, userRef, pid });
    return NextResponse.json({ error: notFound ? "not_found" : "detail_load_failed" }, { status: notFound ? 404 : 500 });
  }
}
