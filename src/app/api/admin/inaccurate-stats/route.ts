// Wave 188 (2026-05-17): 운영자 신고 카테고리 dashboard API.
// Wave 182c 에서 박은 inaccurate_report 데이터 활용.
// 운영자가 "어떤 카테고리 신고 많은지" / "어떤 매물에 몰리는지" 파악 → 시스템 보정 우선순위 결정.
//
// note prefix 패턴 `[카테고리 라벨] ...` 에서 카테고리 추출 (Wave 182c API 박은 패턴).

import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "@/lib/auth-users";
import { logAndRespond } from "@/lib/error-response";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: number;
  user_ref: string;
  pid: number;
  note: string;
  admin_status: string | null;
  admin_response_note: string | null;
  compensation_granted_tokens: number;
  created_at: string;
};

// Wave 182c 카테고리 라벨 (VALID_CATEGORIES → CATEGORY_LABEL).
const CATEGORY_KEYS: Array<{ key: string; label: string }> = [
  { key: "price", label: "시세 부정확" },
  { key: "info", label: "매물 정보 다름" },
  { key: "sold", label: "이미 판매됨" },
  { key: "fake_price", label: "가짜 가격 의심" },
  { key: "other", label: "기타" },
];
const LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  CATEGORY_KEYS.map(({ key, label }) => [label, key]),
);

function extractCategory(note: string): string {
  const match = /^\[([^\]]+)\]/.exec(note ?? "");
  if (!match) return "unknown";
  const label = match[1]?.trim();
  return label ? LABEL_TO_KEY[label] ?? "unknown" : "unknown";
}

function statusOf(row: FeedbackRow): "pending" | "resolved" | "dismissed" {
  const s = row.admin_status;
  if (s === "resolved") return "resolved";
  if (s === "dismissed") return "dismissed";
  return "pending";
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isAdminUser(auth.user)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.max(100, Math.min(5000, Number(url.searchParams.get("limit") ?? "2000") || 2000));

  try {
    const fetchUrl = `${tableUrl("mvp_reveal_feedback")}?select=id,user_ref,pid,note,admin_status,admin_response_note,compensation_granted_tokens,created_at&feedback_type=eq.inaccurate_report&order=created_at.desc&limit=${limit}`;
    const res = await restFetch(fetchUrl, { headers: serviceHeaders() });
    const rows = (await res.json()) as FeedbackRow[];

    // 기간 분할 stats
    const now = Date.now();
    const weekStart = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const monthStart = (() => {
      const d = new Date(now);
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    })();

    function buildStats(filtered: FeedbackRow[]) {
      // 카테고리 × 상태 매트릭스
      const matrix: Record<string, Record<string, number>> = {};
      let total = 0;
      let totalTokens = 0;
      for (const r of filtered) {
        const cat = extractCategory(r.note);
        const st = statusOf(r);
        matrix[cat] = matrix[cat] ?? { pending: 0, resolved: 0, dismissed: 0 };
        matrix[cat][st] = (matrix[cat][st] ?? 0) + 1;
        total += 1;
        totalTokens += Math.max(0, Number(r.compensation_granted_tokens ?? 0));
      }
      // 카테고리별 총합
      const byCategory = CATEGORY_KEYS.concat([{ key: "unknown", label: "기타 (분류 불가)" }]).map(({ key, label }) => {
        const m = matrix[key] ?? { pending: 0, resolved: 0, dismissed: 0 };
        const sum = (m.pending ?? 0) + (m.resolved ?? 0) + (m.dismissed ?? 0);
        return { key, label, total: sum, ...m };
      }).filter((row) => row.total > 0);

      // 상태별 총합
      const byStatus = {
        pending: filtered.filter((r) => statusOf(r) === "pending").length,
        resolved: filtered.filter((r) => statusOf(r) === "resolved").length,
        dismissed: filtered.filter((r) => statusOf(r) === "dismissed").length,
      };

      // resolved 비율 (sample 의미 측정용)
      const responded = byStatus.resolved + byStatus.dismissed;
      const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
      const resolveRate = responded > 0 ? Math.round((byStatus.resolved / responded) * 100) : 0;

      return { total, totalTokens, byCategory, byStatus, responseRate, resolveRate };
    }

    const allTime = buildStats(rows);
    const thisMonth = buildStats(rows.filter((r) => r.created_at >= monthStart));
    const thisWeek = buildStats(rows.filter((r) => r.created_at >= weekStart));

    // Top 매물 — 신고 자주 받는 pid (systemic issue 신호)
    const pidCounts = new Map<number, { count: number; latestAt: string; categories: Set<string>; statuses: Set<string> }>();
    for (const r of rows) {
      const pid = Number(r.pid);
      const entry = pidCounts.get(pid) ?? { count: 0, latestAt: r.created_at, categories: new Set<string>(), statuses: new Set<string>() };
      entry.count += 1;
      if (r.created_at > entry.latestAt) entry.latestAt = r.created_at;
      entry.categories.add(extractCategory(r.note));
      entry.statuses.add(statusOf(r));
      pidCounts.set(pid, entry);
    }
    const topPids = [...pidCounts.entries()]
      .map(([pid, info]) => ({
        pid,
        count: info.count,
        latestAt: info.latestAt,
        categories: [...info.categories],
        statuses: [...info.statuses],
      }))
      .filter((row) => row.count >= 2) // 2회 이상 신고된 매물만 (systemic 신호)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Top 매물 listing meta join (썸네일/이름)
    let listingMap = new Map<number, { name: string | null; thumbnail_url: string | null; price: number | null }>();
    if (topPids.length > 0) {
      const pids = topPids.map((t) => t.pid);
      const listingRes = await restFetch(
        `${tableUrl("mvp_listings")}?select=pid,name,price,thumbnail_url&pid=in.(${pids.join(",")})`,
        { headers: serviceHeaders() },
      );
      const listings = (await listingRes.json()) as Array<{ pid: number; name: string | null; price: number | null; thumbnail_url: string | null }>;
      listingMap = new Map(listings.map((l) => [Number(l.pid), { name: l.name, price: l.price, thumbnail_url: l.thumbnail_url }]));
    }
    const topPidsWithMeta = topPids.map((row) => ({
      ...row,
      listing: listingMap.get(row.pid) ?? null,
    }));

    return NextResponse.json({
      allTime,
      thisMonth,
      thisWeek,
      topPids: topPidsWithMeta,
      sampleSize: rows.length,
      // 카테고리 메타 (UI 색상/라벨)
      categoryMeta: CATEGORY_KEYS.concat([{ key: "unknown", label: "기타 (분류 불가)" }]),
    });
  } catch (err) {
    return logAndRespond("[admin/inaccurate-stats]", err, "inaccurate_stats_failed", {
      userMessage: "신고 통계를 불러오지 못했어요.",
    });
  }
}
