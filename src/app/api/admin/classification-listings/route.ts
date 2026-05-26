// Wave 159 (2026-05-17): admin 전용 listing_type 검증 view.
// 운영자가 AI/regex가 분류한 listing_type 별 매물을 확인하고 분류 정확도 검증.
// 사용 시나리오: accessory/parts/damaged 등 false positive 매물 발견 → override로 normal 박음.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { safeThumbnailUrl } from "@/lib/thumbnail-utils";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const VALID_TYPES = new Set([
  "normal",
  "unknown",
  "accessory",
  "parts",
  "damaged",
  "callout",
  "buying",
  "commercial",
  "multi",
]);

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const userRef = userRefForAuthUser(auth.user.id);

  const url = new URL(req.url);
  const listingType = (url.searchParams.get("listing_type") ?? "accessory").trim();
  if (!VALID_TYPES.has(listingType)) {
    return NextResponse.json({ error: `invalid listing_type: ${listingType}` }, { status: 400 });
  }
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE));
  const skuFilter = url.searchParams.get("sku")?.trim() || null;
  const onlyOverridden = url.searchParams.get("only_overridden") === "1";

  // raw filter — listing_type별 (override 박힌 매물은 listing_type_override로 조회 가능)
  let filter = `detail_status=eq.done&listing_state=eq.active`;
  if (onlyOverridden) {
    filter += `&listing_type_override=eq.${encodeURIComponent(listingType)}`;
  } else {
    filter += `&listing_type=eq.${encodeURIComponent(listingType)}`;
  }
  if (skuFilter) filter += `&sku_id=eq.${encodeURIComponent(skuFilter)}`;

  try {
    // 1. Total count
    const countRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid&${filter}&limit=1`,
      { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
    );
    const contentRange = countRes.headers.get("content-range") ?? "0-0/0";
    const total = Number(contentRange.split("/")[1] ?? 0);

    // 2. Page fetch
    const offset = (page - 1) * pageSize;
    const rawCols = "pid,name,price,thumbnail_url,url,sku_id,sku_name,listing_type,listing_type_override,listing_type_override_by,listing_type_override_at,listing_type_override_reason,bunjang_condition_label,num_comment,qty,description_preview,detail_enriched_at,last_seen_at";
    const rawRes = await restFetch(
      `${tableUrl("mvp_raw_listings")}?select=${rawCols}&${filter}&order=last_seen_at.desc&limit=${pageSize}&offset=${offset}`,
      { headers: serviceHeaders() },
    );
    const rawRows = (await rawRes.json()) as Array<Record<string, unknown>>;
    if (rawRows.length === 0) {
      return NextResponse.json({ page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), items: [] });
    }

    const pids = rawRows.map((r) => Number(r.pid));
    const pidsCsv = pids.join(",");

    const [parsedRes, aiRes, feedbackRes] = await Promise.all([
      restFetch(
        `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,condition_class,parse_confidence,needs_review&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_listing_ai_classifications")}?select=pid,listing_type,reason,confidence,risk_keywords,classified_at&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
      restFetch(
        `${tableUrl("mvp_reveal_feedback")}?select=pid,note,feedback_type,updated_at&user_ref=eq.${encodeURIComponent(userRef)}&pid=in.(${pidsCsv})`,
        { headers: serviceHeaders() },
      ),
    ]);

    const parsedMap = new Map<number, Record<string, unknown>>();
    const aiMap = new Map<number, Record<string, unknown>>();
    const feedbackMap = new Map<number, Record<string, unknown>>();
    for (const r of (await parsedRes.json()) as Array<Record<string, unknown>>) parsedMap.set(Number(r.pid), r);
    for (const r of (await aiRes.json()) as Array<Record<string, unknown>>) aiMap.set(Number(r.pid), r);
    for (const r of (await feedbackRes.json()) as Array<Record<string, unknown>>) feedbackMap.set(Number(r.pid), r);

    const items = rawRows.map((r) => {
      const pid = Number(r.pid);
      const p = parsedMap.get(pid) || {};
      const ai = aiMap.get(pid) || {};
      const fb = feedbackMap.get(pid);
      const note = (fb?.note as string | undefined) ?? "";
      return {
        pid,
        name: (r.name as string) ?? "",
        price: Number(r.price ?? 0),
        thumbnailUrl: safeThumbnailUrl(r.thumbnail_url as string | null),
        bunjangUrl: `https://m.bunjang.co.kr/products/${pid}`,
        skuId: (r.sku_id as string | null) ?? null,
        skuName: (r.sku_name as string | null) ?? null,
        listingType: (r.listing_type as string | null) ?? "unknown",
        listingTypeOverride: (r.listing_type_override as string | null) ?? null,
        listingTypeOverrideBy: (r.listing_type_override_by as string | null) ?? null,
        listingTypeOverrideAt: (r.listing_type_override_at as string | null) ?? null,
        listingTypeOverrideReason: (r.listing_type_override_reason as string | null) ?? null,
        bunjangConditionLabel: (r.bunjang_condition_label as string | null) ?? null,
        numComment: Number(r.num_comment ?? 0),
        qty: Number(r.qty ?? 0),
        descriptionPreview: (r.description_preview as string | null) ?? "",
        detailEnrichedAt: (r.detail_enriched_at as string | null) ?? null,
        lastSeenAt: (r.last_seen_at as string | null) ?? null,
        // parsed
        comparableKey: (p.comparable_key as string | null) ?? null,
        conditionClass: (p.condition_class as string | null) ?? null,
        parseConfidence: p.parse_confidence != null ? Number(p.parse_confidence) : null,
        needsReview: Boolean(p.needs_review),
        // AI classifier
        aiListingType: (ai.listing_type as string | null) ?? null,
        aiReason: (ai.reason as string | null) ?? null,
        aiConfidence: ai.confidence != null ? Number(ai.confidence) : null,
        aiRiskKeywords: (ai.risk_keywords as string[] | null) ?? null,
        aiClassifiedAt: (ai.classified_at as string | null) ?? null,
        // 운영자 코멘트
        hasComment: note.trim().length > 0,
        commentPreview: note.slice(0, 100),
        commentUpdatedAt: (fb?.updated_at as string | undefined) ?? null,
      };
    });

    return NextResponse.json({
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
