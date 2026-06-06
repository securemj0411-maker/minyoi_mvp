"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { OPS_ADMIN_REVEAL_ANALYTICS_PATH } from "@/lib/admin-routes";

import { Notice } from "../_ui/primitives";

type Bucket = { key: string; label: string; count: number };
type RevealRow = {
  id: number;
  pid: number;
  userRef: string;
  userEmail: string | null;
  userNickname: string | null;
  title: string;
  url: string | null;
  thumbnailUrl: string | null;
  price: number | null;
  source: string;
  sourceLabel: string;
  category: string;
  sku: string;
  condition: string | null;
  expectedProfit: number;
  currentProfit: number | null;
  confidence: number | null;
  revealedAt: string;
  linkClickedAt: string | null;
  hiddenAt: string | null;
  listingState: string | null;
  saleStatus: string | null;
  eventCounts: Record<string, number>;
};
type ApiData = {
  params: { days: number; limit: number; userRef: string | null };
  summary: {
    reveals: number;
    uniqueUsers: number;
    uniqueProducts: number;
    linkClicks: number;
    linkClickRate: number;
    hidden: number;
    originalClickedEvents: number;
    reportOpenedEvents: number;
    scrapSavedEvents: number;
    computedAt: string;
  };
  breakdowns: {
    priceBuckets: Bucket[];
    profitBuckets: Bucket[];
    categories: Bucket[];
    sources: Bucket[];
    skus: Bucket[];
    conditions: Bucket[];
    users: Bucket[];
  };
  rows: RevealRow[];
};

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function money(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "—";
  return `₩${Number(value).toLocaleString("ko-KR")}`;
}

function percent(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "—";
  return `${Math.round(Number(value) * 100)}%`;
}

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  return KST_FORMATTER.format(new Date(value));
}

function userLabel(row: RevealRow) {
  return row.userNickname || row.userEmail || row.userRef;
}

function barWidth(count: number, max: number) {
  if (max <= 0) return "0%";
  return `${Math.max(5, Math.round((count / max) * 100))}%`;
}

function BreakdownPanel({ title, rows }: { title: string; rows: Bucket[] }) {
  const max = Math.max(...rows.map((row) => row.count), 0);
  return (
    <section className="rounded-sm border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-900 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
        {title}
      </div>
      <div className="space-y-2 p-3">
        {rows.length === 0 ? (
          <div className="py-6 text-center text-xs uppercase tracking-wide text-zinc-400">no data</div>
        ) : rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-bold text-zinc-200">{row.label}</span>
              <span className="tabular-nums text-emerald-300">{row.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
              <div className="h-full rounded-full bg-emerald-500/80" style={{ width: barWidth(row.count, max) }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-3">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums text-emerald-300">{value}</div>
      {sub ? <div className="mt-1 text-xs uppercase tracking-wide text-zinc-400">{sub}</div> : null}
    </div>
  );
}

export default function RevealAnalyticsClient() {
  const searchParams = useSearchParams();
  const initialUserRef = searchParams.get("userRef") ?? "";
  const [days, setDays] = useState(30);
  const [userRef, setUserRef] = useState(initialUserRef);
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "users" | "ledger">("overview");
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    async function pull() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ days: String(days), limit: userRef ? "1000" : "3000" });
        if (userRef.trim()) params.set("userRef", userRef.trim());
        const res = await fetch(`/api/admin/reveal-analytics?${params.toString()}`, { cache: "no-store" });
        const text = await res.text();
        let json: ApiData | { error?: string };
        try {
          json = text ? JSON.parse(text) as ApiData | { error?: string } : { error: `empty response (${res.status})` };
        } catch {
          json = { error: `invalid response (${res.status}): ${text.slice(0, 120) || "empty"}` };
        }
        if (!res.ok) throw new Error("error" in json && json.error ? json.error : `request failed ${res.status}`);
        if (!stopped) setData(json as ApiData);
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "reveal analytics failed");
      } finally {
        if (!stopped) setLoading(false);
      }
    }
    void pull();
    return () => { stopped = true; };
  }, [days, userRef]);

  const tabs = useMemo(() => [
    { key: "overview" as const, label: "OVERVIEW" },
    { key: "products" as const, label: "PRODUCTS" },
    { key: "users" as const, label: "USERS" },
    { key: "ledger" as const, label: "LEDGER" },
  ], []);

  return (
    <section className="font-mono">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 p-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-8 rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-xs font-bold text-zinc-200"
        >
          <option value={1}>1D</option>
          <option value={7}>7D</option>
          <option value={30}>30D</option>
          <option value={90}>90D</option>
        </select>
        <input
          value={userRef}
          onChange={(e) => setUserRef(e.target.value)}
          placeholder="filter user_ref"
          className="h-8 min-w-[260px] flex-1 rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200 placeholder:text-zinc-400"
        />
        {userRef ? (
          <Link
            href={OPS_ADMIN_REVEAL_ANALYTICS_PATH}
            onClick={() => setUserRef("")}
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs font-black uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
          >
            CLEAR USER
          </Link>
        ) : null}
        <div className="ml-auto text-xs uppercase tracking-wide text-zinc-400">
          {loading ? "loading..." : data ? `computed ${fmt(data.summary.computedAt)}` : "—"}
        </div>
      </div>

      {error ? (
        <Notice tone="rose" className="mb-4">
          {error}
        </Notice>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="reveals" value={data ? data.summary.reveals.toLocaleString("ko-KR") : "—"} />
        <Kpi label="users" value={data ? data.summary.uniqueUsers.toLocaleString("ko-KR") : "—"} />
        <Kpi label="products" value={data ? data.summary.uniqueProducts.toLocaleString("ko-KR") : "—"} />
        <Kpi label="link click" value={data ? data.summary.linkClicks.toLocaleString("ko-KR") : "—"} sub={data ? percent(data.summary.linkClickRate) : undefined} />
        <Kpi label="report open" value={data ? data.summary.reportOpenedEvents.toLocaleString("ko-KR") : "—"} />
        <Kpi label="original evt" value={data ? data.summary.originalClickedEvents.toLocaleString("ko-KR") : "—"} />
        <Kpi label="scrap" value={data ? data.summary.scrapSavedEvents.toLocaleString("ko-KR") : "—"} />
        <Kpi label="hidden" value={data ? data.summary.hidden.toLocaleString("ko-KR") : "—"} />
      </div>

      <nav className="mb-4 flex gap-1 overflow-x-auto text-xs uppercase tracking-[0.16em]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-sm border px-3 py-2 font-black ${
              activeTab === tab.key
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <BreakdownPanel title="PRICE BUCKET" rows={data?.breakdowns.priceBuckets ?? []} />
          <BreakdownPanel title="PROFIT BUCKET" rows={data?.breakdowns.profitBuckets ?? []} />
          <BreakdownPanel title="SOURCE" rows={data?.breakdowns.sources ?? []} />
          <BreakdownPanel title="CATEGORY" rows={data?.breakdowns.categories ?? []} />
          <BreakdownPanel title="CONDITION" rows={data?.breakdowns.conditions ?? []} />
          <BreakdownPanel title="TOP USERS" rows={data?.breakdowns.users ?? []} />
        </div>
      ) : null}

      {activeTab === "products" ? (
        <div className="grid gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
          <BreakdownPanel title="TOP SKU / PRODUCT KEYS" rows={data?.breakdowns.skus ?? []} />
          <RevealTable rows={data?.rows ?? []} mode="product" />
        </div>
      ) : null}

      {activeTab === "users" ? (
        <div className="grid gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
          <BreakdownPanel title="TOP USERS" rows={data?.breakdowns.users ?? []} />
          <RevealTable rows={data?.rows ?? []} mode="user" />
        </div>
      ) : null}

      {activeTab === "ledger" ? <RevealTable rows={data?.rows ?? []} mode="ledger" /> : null}
    </section>
  );
}

function RevealTable({ rows, mode }: { rows: RevealRow[]; mode: "product" | "user" | "ledger" }) {
  return (
    <div className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-900 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
        {mode === "ledger" ? "LATEST REVEALS" : "REVEAL ROWS"}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-zinc-900/80 text-left text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-3 py-2">TIME</th>
              <th className="px-3 py-2">PRODUCT</th>
              <th className="px-3 py-2">USER</th>
              <th className="px-3 py-2">SOURCE</th>
              <th className="px-3 py-2">CATEGORY</th>
              <th className="px-3 py-2 text-right">PRICE</th>
              <th className="px-3 py-2 text-right">PROFIT</th>
              <th className="px-3 py-2">FUNNEL</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-xs uppercase tracking-wide text-zinc-400">no reveal rows</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-900 align-top hover:bg-zinc-900/35">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-500">{fmt(row.revealedAt)}</td>
                <td className="max-w-[320px] px-3 py-2">
                  <div className="truncate font-bold text-zinc-100">{row.title}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-400">{row.sku}</div>
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-black uppercase tracking-wide text-blue-300 hover:text-blue-200">
                      original ↗
                    </a>
                  ) : null}
                </td>
                <td className="max-w-[220px] px-3 py-2">
                  <div className="truncate font-bold text-zinc-300">{userLabel(row)}</div>
                  <Link
                    href={`${OPS_ADMIN_REVEAL_ANALYTICS_PATH}?userRef=${encodeURIComponent(row.userRef)}`}
                    className="mt-0.5 block truncate text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    {row.userRef}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-300">{row.sourceLabel}</td>
                <td className="px-3 py-2 text-zinc-400">{row.category}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{money(row.price)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-300">{money(row.currentProfit ?? row.expectedProfit)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.linkClickedAt ? <Chip tone="blue">link</Chip> : null}
                    {row.eventCounts.detail_report_opened ? <Chip tone="amber">report {row.eventCounts.detail_report_opened}</Chip> : null}
                    {row.eventCounts.original_clicked ? <Chip tone="blue">origin {row.eventCounts.original_clicked}</Chip> : null}
                    {row.eventCounts.scrap_saved ? <Chip tone="emerald">scrap</Chip> : null}
                    {row.hiddenAt ? <Chip tone="rose">hidden</Chip> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "blue" | "amber" | "emerald" | "rose" }) {
  const classes = {
    blue: "border-blue-800 bg-blue-950/35 text-blue-300",
    amber: "border-amber-800 bg-amber-950/35 text-amber-300",
    emerald: "border-emerald-800 bg-emerald-950/35 text-emerald-300",
    rose: "border-rose-800 bg-rose-950/35 text-rose-300",
  }[tone];
  return <span className={`rounded-sm border px-1.5 py-0.5 text-xs font-black uppercase tracking-wide ${classes}`}>{children}</span>;
}
