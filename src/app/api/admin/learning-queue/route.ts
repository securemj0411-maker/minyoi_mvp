// Wave 244 (2026-05-19): learning queue admin list endpoint.
//
// GET /api/admin/learning-queue
//   ?freq=3       (default — frequency_count >= freq)
//   ?status=pending (default — pending only)
//   ?sku_id=...   (optional)
//   ?category=... (optional — joins to mvp_candidate_pool via pid)
//   ?page=1&pageSize=20
//
// 응답 row 마다:
//   - learning_queue 본체 (sku_id, ai_reason, suggested_must_not_contain, ai_classification, frequency_count …)
//   - sku_name (mvp_listings.sku_name 첫 매물 기준)
//   - samples: 최근 5개 (pid, name, price, url, last_seen)
//     -- mvp_raw_listings + mvp_listings join.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_FREQ_MIN = 3;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SAMPLE_LIMIT = 5;

type QueueRow = {
  id: number;
  sku_id: string;
  pid: number;
  ai_classification: string;
  ai_confidence: number | null;
  ai_reason: string | null;
  suggested_must_not_contain: string[] | null;
  matched_text: string;
  frequency_count: number;
  status: string;
  false_positive: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  applied_at: string | null;
  applied_to_commit: string | null;
  created_at: string;
  updated_at: string;
};

type SamplePid = {
  pid: number;
  name: string | null;
  price: number | null;
  url: string | null;
  thumbnail_url: string | null;
  last_seen_at: string | null;
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const freqMin = Math.max(1, Number(url.searchParams.get("freq") ?? DEFAULT_FREQ_MIN) || DEFAULT_FREQ_MIN);
  const status = (url.searchParams.get("status") ?? "pending").trim();
  const skuFilter = url.searchParams.get("sku_id")?.trim() || null;
  const categoryFilter = url.searchParams.get("category")?.trim() || null;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));

  try {
    // Wave 244: false_positive 박힌 row 는 admin UI 에서 가림 (pending 만 보일 때).
    // status filter 가 'all' 이면 false_positive 도 표시.
    let filter = `frequency_count=gte.${freqMin}`;
    if (status !== "all") filter += `&status=eq.${encodeURIComponent(status)}&false_positive=eq.false`;
    if (skuFilter) filter += `&sku_id=eq.${encodeURIComponent(skuFilter)}`;

    const offset = (page - 1) * pageSize;
    const cols = "id,sku_id,pid,ai_classification,ai_confidence,ai_reason,suggested_must_not_contain,matched_text,frequency_count,status,false_positive,reviewed_at,reviewed_by,applied_at,applied_to_commit,created_at,updated_at";

    // 1. count
    const countRes = await restFetch(
      `${tableUrl("mvp_catalog_learning_queue")}?select=id&${filter}&limit=1`,
      { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
    );
    const contentRange = countRes.headers.get("content-range") ?? "0-0/0";
    const totalUnfiltered = Number(contentRange.split("/")[1] ?? 0);

    // 2. page fetch
    const listRes = await restFetch(
      `${tableUrl("mvp_catalog_learning_queue")}?select=${cols}&${filter}&order=frequency_count.desc,created_at.desc&limit=${pageSize}&offset=${offset}`,
      { headers: serviceHeaders() },
    );
    let rows = (await listRes.json()) as QueueRow[];

    // 3. category filter (joins candidate_pool — 후 filter 라 정확한 total 은 unfiltered count 기준)
    if (categoryFilter && rows.length > 0) {
      const pidsCsv = rows.map((r) => r.pid).join(",");
      const poolRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid&category=eq.${encodeURIComponent(categoryFilter)}&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      );
      const allowed = new Set(((await poolRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid)));
      rows = rows.filter((r) => allowed.has(Number(r.pid)));
    }

    if (rows.length === 0) {
      return NextResponse.json({
        page,
        pageSize,
        total: totalUnfiltered,
        totalPages: Math.max(1, Math.ceil(totalUnfiltered / pageSize)),
        items: [],
      });
    }

    // 4. sku_id 별 sample pids 5건 (mvp_raw_listings + mvp_listings join)
    //    같은 sku_id 가 여러 row 에 박힐 수 있어 sku 별로 한 번에 가져옴.
    const skuIds = Array.from(new Set(rows.map((r) => r.sku_id))).filter((s) => s);
    const samplesBySku = new Map<string, SamplePid[]>();
    const skuNames = new Map<string, string | null>();

    if (skuIds.length > 0) {
      const skuList = skuIds.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",");
      // 모든 sku 의 최근 매물 pids (admin sample 용). limit 넉넉히 (sku 별 5개 분배).
      const rawRes = await restFetch(
        `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,last_seen_at&sku_id=in.(${skuList})&order=last_seen_at.desc&limit=${skuIds.length * SAMPLE_LIMIT * 3}`,
        { headers: serviceHeaders() },
      );
      const rawRows = (await rawRes.json()) as Array<{ pid: number; sku_id: string; sku_name: string | null; last_seen_at: string | null }>;
      const samplePidsBySku = new Map<string, Array<{ pid: number; last_seen_at: string | null }>>();
      for (const row of rawRows) {
        if (!skuNames.has(row.sku_id) && row.sku_name) skuNames.set(row.sku_id, row.sku_name);
        const list = samplePidsBySku.get(row.sku_id) ?? [];
        if (list.length < SAMPLE_LIMIT) list.push({ pid: Number(row.pid), last_seen_at: row.last_seen_at });
        samplePidsBySku.set(row.sku_id, list);
      }

      // listings join — sample pids 의 name/price/url/thumbnail
      const allSamplePids = Array.from(samplePidsBySku.values()).flat().map((s) => s.pid);
      const listingMap = new Map<number, { name: string | null; price: number | null; url: string | null; thumbnail_url: string | null }>();
      if (allSamplePids.length > 0) {
        const listingRes = await restFetch(
          `${tableUrl("mvp_listings")}?select=pid,name,price,url,thumbnail_url&pid=in.(${allSamplePids.join(",")})`,
          { headers: serviceHeaders() },
        );
        const listingRows = (await listingRes.json()) as Array<{ pid: number; name: string | null; price: number | null; url: string | null; thumbnail_url: string | null }>;
        for (const row of listingRows) listingMap.set(Number(row.pid), row);
      }

      for (const [skuId, pids] of samplePidsBySku) {
        const samples: SamplePid[] = pids.map((p) => {
          const l = listingMap.get(p.pid);
          return {
            pid: p.pid,
            name: l?.name ?? null,
            price: l?.price ?? null,
            url: l?.url ?? `https://m.bunjang.co.kr/products/${p.pid}`,
            thumbnail_url: l?.thumbnail_url ?? null,
            last_seen_at: p.last_seen_at,
          };
        });
        samplesBySku.set(skuId, samples);
      }
    }

    const items = rows.map((row) => ({
      id: row.id,
      skuId: row.sku_id,
      skuName: skuNames.get(row.sku_id) ?? null,
      pid: row.pid,
      aiClassification: row.ai_classification,
      aiConfidence: row.ai_confidence,
      aiReason: row.ai_reason,
      suggestedMustNotContain: row.suggested_must_not_contain ?? [],
      matchedText: row.matched_text,
      frequencyCount: row.frequency_count,
      status: row.status,
      falsePositive: row.false_positive,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      appliedAt: row.applied_at,
      appliedToCommit: row.applied_to_commit,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      samples: samplesBySku.get(row.sku_id) ?? [],
    }));

    return NextResponse.json({
      page,
      pageSize,
      total: totalUnfiltered,
      totalPages: Math.max(1, Math.ceil(totalUnfiltered / pageSize)),
      items,
    });
  } catch (err) {
    console.error("[admin/learning-queue] list error", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
