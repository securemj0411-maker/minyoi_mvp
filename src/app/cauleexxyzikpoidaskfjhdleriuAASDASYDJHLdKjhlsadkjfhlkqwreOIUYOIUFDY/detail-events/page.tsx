// Wave 503 (2026-05-21): 상세 열람/쉬운모드 행동 로그 운영자 대시보드.
// 결제 CTA 개선을 위해 사용자가 어디서 빠지는지, 숫자 리포트/원본 클릭까지 가는지 본다.
// Wave launch-108 (2026-05-24): admin auth + nav layout 위임.

import { detailEventLabel } from "@/lib/detail-analytics";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DetailEventRow = {
  id: number;
  user_ref: string;
  auth_user_id: string | null;
  pid: number;
  event_type: string;
  surface: string | null;
  session_id: string | null;
  step_index: number | null;
  step_total: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ListingRow = {
  pid: number;
  name: string | null;
  sku_name: string | null;
  price: number | null;
  thumbnail_url: string | null;
  url: string | null;
};

type RawRow = {
  pid: number;
  source: string | null;
  seller_source: string | null;
  sku_name: string | null;
  shop_review_rating: number | null;
  shop_review_count: number | null;
};

type ListingMeta = {
  name: string;
  skuName: string;
  price: number | null;
  thumbnailUrl: string | null;
  url: string | null;
  source: string;
  sellerReview: string;
};

async function fetchDetailEvents(): Promise<{ rows: DetailEventRow[]; error: string | null }> {
  try {
    const res = await restFetch(
      `${tableUrl("mvp_detail_events")}?select=id,user_ref,auth_user_id,pid,event_type,surface,session_id,step_index,step_total,metadata,created_at&order=created_at.desc&limit=500`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
    return { rows: (await res.json()) as DetailEventRow[], error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "detail events fetch failed" };
  }
}

async function fetchListingMeta(pids: number[]) {
  const uniquePids = Array.from(new Set(pids.filter((pid) => Number.isFinite(pid) && pid > 0))).slice(0, 500);
  if (uniquePids.length === 0) return new Map<number, ListingMeta>();
  const csv = uniquePids.join(",");

  const [listingResult, rawResult] = await Promise.allSettled([
    restFetch(
      `${tableUrl("mvp_listings")}?select=pid,name,sku_name,price,thumbnail_url,url&pid=in.(${csv})`,
      { headers: serviceHeaders(), cache: "no-store" },
    ),
    restFetch(
      `${tableUrl("mvp_raw_listings")}?select=pid,source,seller_source,sku_name,shop_review_rating,shop_review_count&pid=in.(${csv})`,
      { headers: serviceHeaders(), cache: "no-store" },
    ),
  ]);

  const listings = listingResult.status === "fulfilled" ? ((await listingResult.value.json()) as ListingRow[]) : [];
  const raws = rawResult.status === "fulfilled" ? ((await rawResult.value.json()) as RawRow[]) : [];
  const rawMap = new Map(raws.map((row) => [row.pid, row]));
  const map = new Map<number, ListingMeta>();

  for (const listing of listings) {
    const raw = rawMap.get(listing.pid);
    const reviewCount = Number(raw?.shop_review_count ?? 0);
    const rating = Number(raw?.shop_review_rating ?? 0);
    map.set(listing.pid, {
      name: listing.name ?? raw?.sku_name ?? `PID ${listing.pid}`,
      skuName: listing.sku_name ?? raw?.sku_name ?? "",
      price: listing.price,
      thumbnailUrl: listing.thumbnail_url,
      url: listing.url,
      source: raw?.seller_source ?? raw?.source ?? "unknown",
      sellerReview: reviewCount > 0 && rating > 0 ? `${rating.toFixed(1)}점 · 후기 ${reviewCount}건` : reviewCount > 0 ? `후기 ${reviewCount}건` : "-",
    });
  }

  for (const raw of raws) {
    if (map.has(raw.pid)) continue;
    const reviewCount = Number(raw.shop_review_count ?? 0);
    const rating = Number(raw.shop_review_rating ?? 0);
    map.set(raw.pid, {
      name: raw.sku_name ?? `PID ${raw.pid}`,
      skuName: raw.sku_name ?? "",
      price: null,
      thumbnailUrl: null,
      url: null,
      source: raw.seller_source ?? raw.source ?? "unknown",
      sellerReview: reviewCount > 0 && rating > 0 ? `${rating.toFixed(1)}점 · 후기 ${reviewCount}건` : reviewCount > 0 ? `후기 ${reviewCount}건` : "-",
    });
  }

  return map;
}

function kstTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function countType(rows: DetailEventRow[], type: string) {
  return rows.filter((row) => row.event_type === type).length;
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function money(value: number | null) {
  if (!Number.isFinite(Number(value))) return "-";
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

function metadataPreview(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) return "-";
  const text = JSON.stringify(value);
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function eventCounts(rows: DetailEventRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.event_type, (counts.get(row.event_type) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function sessionRows(rows: DetailEventRow[], listings: Map<number, ListingMeta>) {
  const map = new Map<string, DetailEventRow[]>();
  for (const row of rows) {
    const key = row.session_id || `single:${row.id}`;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return Array.from(map.entries())
    .map(([sessionId, events]) => {
      const ordered = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const newest = ordered.at(-1)!;
      return {
        sessionId,
        newest,
        first: ordered[0]!,
        listing: listings.get(newest.pid) ?? null,
        sequence: ordered.map((event) => detailEventLabel(event.event_type)).join(" → "),
      };
    })
    .sort((a, b) => new Date(b.newest.created_at).getTime() - new Date(a.newest.created_at).getTime())
    .slice(0, 80);
}

export default async function DetailEventsAdminPage() {
  // admin auth 는 layout.tsx 에서 처리 (Wave launch-108).
  const { rows, error } = await fetchDetailEvents();
  const listings = await fetchListingMeta(rows.map((row) => row.pid));
  const detailOpened = countType(rows, "detail_opened");
  const easyStarted = countType(rows, "easy_mode_started");
  const easyCompleted = countType(rows, "easy_mode_completed");
  const reportOpened = countType(rows, "detail_report_opened");
  const originalClicked = countType(rows, "original_clicked");
  const paywallShown = countType(rows, "free_limit_paywall_shown");
  const uniqueUsers = new Set(rows.map((row) => row.user_ref)).size;
  const uniqueSessions = new Set(rows.map((row) => row.session_id).filter(Boolean)).size;
  const sessions = sessionRows(rows, listings);

  // Wave launch-108 (2026-05-24): nav + 헤더 layout 위임 + Bloomberg 톤.
  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6">
      <header className="mb-4 border-b border-zinc-800 pb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">▌DETAIL EVENTS</p>
        <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-100">funnel · session · CTR breakdown</h1>
        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          last 500 events — detail open · easy mode · numeric report · original click
        </p>
      </header>

      <section className="px-0">
        {/* legacy inner content — 한국어 KpiCard 라벨 keep (다음 wave 에서 영문화 권장). */}

        {error ? (
          <section className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
            상세 행동 테이블을 아직 읽지 못했어요. Supabase migration 적용 후 다시 확인하세요.
            <div className="mt-2 break-all text-[11px] font-medium opacity-75">{error}</div>
          </section>
        ) : null}

        <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <KpiCard label="이벤트" value={rows.length} />
          <KpiCard label="사용자" value={uniqueUsers} />
          <KpiCard label="세션" value={uniqueSessions} />
          <KpiCard label="상세 열람" value={detailOpened} />
          <KpiCard label="쉬운모드 완료율" value={rate(easyCompleted, easyStarted)} sub={`${easyCompleted}/${easyStarted}`} />
          <KpiCard label="숫자 리포트 전환" value={rate(reportOpened, detailOpened)} sub={`${reportOpened}/${detailOpened}`} />
          <KpiCard label="원본 클릭률" value={rate(originalClicked, detailOpened)} sub={`${originalClicked}/${detailOpened}`} />
          <KpiCard label="결제 CTA" value={paywallShown} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="rounded-2xl border border-[#e2d9cb] bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-sm font-black text-[#223127] dark:text-white">이벤트 분포</h2>
            <div className="mt-3 space-y-2">
              {eventCounts(rows).map(([type, value]) => (
                <div key={type} className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f2e8] px-3 py-2 text-xs dark:bg-zinc-950/60">
                  <span className="font-bold text-[#354239] dark:text-zinc-200">{detailEventLabel(type)}</span>
                  <span className="font-black text-sky-700 dark:text-sky-300">{value}</span>
                </div>
              ))}
              {rows.length === 0 ? (
                <div className="rounded-xl bg-[#f8f2e8] px-3 py-3 text-xs font-bold text-[#687366] dark:bg-zinc-950/60 dark:text-zinc-400">
                  아직 기록된 행동이 없어요.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e2d9cb] bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-sm font-black text-[#223127] dark:text-white">최근 세션 흐름</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[820px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-[#7b8378] dark:text-zinc-500">
                  <tr className="border-b border-[#e2d9cb] dark:border-zinc-800">
                    <th className="py-2 pr-3">시간</th>
                    <th className="py-2 pr-3">사용자</th>
                    <th className="py-2 pr-3">매물</th>
                    <th className="py-2 pr-3">흐름</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee5d7] dark:divide-zinc-800">
                  {sessions.map((session) => (
                    <tr key={session.sessionId} className="align-top">
                      <td className="py-2 pr-3 font-mono text-[11px] text-[#687366] dark:text-zinc-400">{kstTime(session.newest.created_at)}</td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-[#354239] dark:text-zinc-300">{session.newest.user_ref}</td>
                      <td className="py-2 pr-3">
                        <div className="max-w-[240px] truncate font-black text-[#223127] dark:text-zinc-100">
                          {session.listing?.name ?? `PID ${session.newest.pid}`}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#7b8378] dark:text-zinc-500">
                          PID {session.newest.pid} · {session.listing?.source ?? "-"} · {money(session.listing?.price ?? null)}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="max-w-[420px] break-keep font-bold leading-5 text-[#354239] dark:text-zinc-200">{session.sequence}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e2d9cb] bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-sm font-black text-[#223127] dark:text-white">최근 이벤트 원장</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1120px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[#7b8378] dark:text-zinc-500">
                <tr className="border-b border-[#e2d9cb] dark:border-zinc-800">
                  <th className="py-2 pr-3">시간</th>
                  <th className="py-2 pr-3">이벤트</th>
                  <th className="py-2 pr-3">매물</th>
                  <th className="py-2 pr-3">가격/판매자</th>
                  <th className="py-2 pr-3">단계</th>
                  <th className="py-2 pr-3">메타</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee5d7] dark:divide-zinc-800">
                {rows.map((row) => {
                  const listing = listings.get(row.pid);
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="py-2 pr-3 font-mono text-[11px] text-[#687366] dark:text-zinc-400">{kstTime(row.created_at)}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex rounded-full bg-sky-50 px-2 py-1 font-black text-sky-800 ring-1 ring-sky-100 dark:bg-sky-950/30 dark:text-sky-200 dark:ring-sky-900/50">
                          {detailEventLabel(row.event_type)}
                        </span>
                        <div className="mt-1 font-mono text-[10px] text-[#8b917f] dark:text-zinc-500">{row.session_id ?? "-"}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="max-w-[300px] truncate font-black text-[#223127] dark:text-zinc-100">
                          {listing?.name ?? `PID ${row.pid}`}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#7b8378] dark:text-zinc-500">
                          PID {row.pid} · {listing?.skuName || "-"} · {listing?.source ?? "-"}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-black text-emerald-700 dark:text-blue-300">{money(listing?.price ?? null)}</div>
                        <div className="mt-0.5 text-[11px] text-[#7b8378] dark:text-zinc-500">{listing?.sellerReview ?? "-"}</div>
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-[#354239] dark:text-zinc-300">
                        {row.step_index != null ? `${row.step_index + 1}/${row.step_total ?? "?"}` : "-"}
                      </td>
                      <td className="max-w-[300px] break-all py-2 pr-3 font-mono text-[10px] leading-4 text-[#687366] dark:text-zinc-400">
                        {metadataPreview(row.metadata)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white/82 p-3 shadow-sm dark:border-sky-950/50 dark:bg-zinc-900/70">
      <div className="text-[10px] font-black uppercase tracking-wider text-[#7b8378] dark:text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-black text-[#223127] dark:text-white">{value}</div>
      {sub ? <div className="mt-0.5 text-[10px] font-bold text-[#687366] dark:text-zinc-400">{sub}</div> : null}
    </div>
  );
}
