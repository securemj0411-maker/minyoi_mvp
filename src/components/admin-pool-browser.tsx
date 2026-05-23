"use client";

// Wave 90 (2026-05-15): admin 전용 풀 매물 브라우저.
// 페이지네이션 (1, 2, 3, ...) + 카드 list + 시세 근거 디버그 토글.
// 운영자가 팩 결제 없이 풀 전체 검증 가능.

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import MarketHistoryChart from "@/components/market-history-chart";
import { MarketSourceDebug } from "@/components/market-source-debug";
import { ConditionChip, ConditionTierChip, ConditionChipsList } from "@/components/condition-chip";
import { RiskScoreBar } from "@/components/risk-score-bar";
import { LiquidityCurveMini } from "@/components/liquidity-curve-mini";
import { DanawaLogo, MarketplaceSourceBadge } from "@/components/market-brand-logo";
import { CATALOG } from "@/lib/catalog";
import { buildVerdicts, VERDICT_TONE_CLASS } from "@/lib/listing-verdicts";
import { buyPriceGuidance, verdictUiLabel } from "@/lib/buy-price-guidance";
import { categoryFromComparableKey } from "@/lib/category-readiness";
import { detectBrandDepth } from "@/lib/category-brand-depth";

type PoolItem = {
  pid: number;
  name: string;
  price: number;
  skuId: string | null;
  skuName: string | null;
  skuMedian: number;
  thumbnailUrl: string | null;
  bunjangUrl: string;
  listingUrl: string;
  marketplaceSource: string;
  marketplaceLabel: string;
  comparableKey: string | null;
  parseConfidence: number | null;
  needsReview: boolean;
  // 2026-05-16 (사용자 코멘트 #120): 시세 출처 표시 (새상품 기준 / 통합 S급 / 통합 중고 매물)
  conditionClass: string | null;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  query: string | null;
  sellerUid: string | null;
  band: number;
  poolStatus: string;
  category: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
  exposureCount: number;
  maxExposure: number;
  lastVerifiedAt: string;
  hasComment: boolean;
  commentPreview: string;
  commentUpdatedAt: string | null;
  // 2026-05-17 Phase 0 L4 — RiskScoreBar 입력.
  descriptionPreview: string | null;
  sellerReviewRating: number | null;
  sellerReviewCount: number | null;
  imageCount: number | null;
  freeShipping: boolean;
  numFaved: number | null;
  numComment: number | null;
  scoreFlags: string[];
  // Wave 182 Phase 3 (2026-05-17): base option fallback metadata (옵션 명시 X → 가장 낮은 옵션 가정).
  optionBaseAssumed: string[] | null;
  // Wave 714d (2026-05-23): 신발/의류 5-tier S/A/B/C/D + raw 표현 chips.
  conditionTier?: string | null;
  conditionCluster?: string | null;
  conditionConfidence?: number | null;
  conditionFlags?: Record<string, unknown> | null;
  conditionChips?: string[] | null;
  // Wave 187 (2026-05-17): L6 Liquidity 곡선 입력 — comparable_key 별 velocity + price 분포.
  velocityP25Hours: number | null;
  velocityMedianHours: number | null;
  velocityP75Hours: number | null;
  velocitySoldSampleCount: number | null;
  marketP25Price: number | null;
  marketMedianPrice: number | null;
  marketP75Price: number | null;
};

type Resp = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: PoolItem[];
  stats: {
    byBandStatus: Record<string, number>;
    totals: Record<string, number>;
    totalAll: number;
    bySku: Array<{ sku_id: string; sku_name: string | null; ready_count: number }>;
    byPriceBucket: Array<{ key: string; label: string; ready_count: number }>;
    byCategory: Array<{ category: string; ready_count: number }>;
    bySource: Array<{ source: string; label: string; ready_count: number }>;
  } | null;
};

const krw = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;

function relAge(iso: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 24) return `${h.toFixed(1)}시간 전`;
  return `${(h / 24).toFixed(1)}일 전`;
}

// Wave 2026-05-19 (외부인 #1 신선도): 6h 초과 시 재검증 권장, 24h 초과 시 데이터 오래됨.
// 모달의 verificationDisplay와 같은 임계 적용 — 운영자 풀에서 stale 매물 빠르게 식별.
function verifiedAtStaleness(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const h = (Date.now() - t) / 3_600_000;
  if (h < 6) return null;
  if (h < 24) return { tone: "warn" as const, label: "재검증 권장" };
  return { tone: "danger" as const, label: "데이터 오래됨" };
}

const STATUS_OPTIONS = [
  { v: "ready", label: "ready (활성)" },
  { v: "invalidated", label: "invalidated (만료/소진)" },
  { v: "spent", label: "spent (사용자에게 노출됨)" },
];

const SORT_OPTIONS = [
  { v: "newest_added", label: "최신순 (풀 진입)" },
  { v: "profit_high", label: "차익 높은순" },
  { v: "profit_low", label: "차익 낮은순" },
  { v: "confidence_high", label: "신뢰도 높은순" },
  { v: "latest", label: "최신 검증순" },
];

const CATEGORY_LABEL: Record<string, string> = {
  earphone: "이어폰",
  smartwatch: "스마트워치",
  smartphone: "스마트폰",
  tablet: "태블릿",
  laptop: "노트북",
  monitor: "모니터",
  speaker: "스피커",
  camera: "카메라",
  game_console: "게임기",
  desktop: "데스크탑",
  home_appliance: "가전",
  small_appliance: "소형가전",
  watch: "시계",
  sport_golf: "골프",
  shoe: "신발",
  bag: "가방",
  bike: "자전거",
  drone: "드론",
  perfume: "향수",
  kickboard: "킥보드",
  lego: "레고",
  clothing: "의류",
  unknown: "미분류",
};

function categoryLabel(category: string) {
  return CATEGORY_LABEL[category] ?? category;
}

export default function AdminPoolBrowser({ endpoint = "/api/admin/pool-listings" }: { endpoint?: string } = {}) {
  const [data, setData] = useState<Resp | null>(null);
  const [stats, setStats] = useState<Resp["stats"]>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [status, setStatus] = useState("ready");
  const [band, setBand] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [priceBucket, setPriceBucket] = useState<string>("");
  const [sku, setSku] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [sort, setSort] = useState("newest_added");
  // Wave 176 (2026-05-17): 검색 — searchDraft는 input 입력 buffer, searchQuery는 실제 fetch 파라미터.
  // Enter 또는 🔍 버튼 클릭 시 draft → query 적용 (typing 마다 fetch 안 함, UX 부담 ↓).
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status, sort });
      if (band) params.set("band", band);
      if (category) params.set("category", category);
      if (priceBucket) params.set("priceBucket", priceBucket);
      if (sku) params.set("sku", sku);
      if (source) params.set("source", source);
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`${endpoint}?${params}`, { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as Resp;
      setData(json);
      // stats는 page=1 응답에만 포함 — 받으면 메모리에 보관 (페이지 이동해도 유지)
      if (json.stats) setStats(json.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, band, category, priceBucket, sku, source, sort, searchQuery, endpoint]);

  // Wave 176: Enter / 🔍 버튼 / X 클릭 시 draft → query 적용 + 페이지 리셋.
  const applySearch = useCallback(() => {
    setSearchQuery(searchDraft.trim());
    setPage(1);
  }, [searchDraft]);

  const clearSearch = useCallback(() => {
    setSearchDraft("");
    setSearchQuery("");
    setPage(1);
  }, []);

  const clearPoolFilters = useCallback(() => {
    setBand("");
    setCategory("");
    setPriceBucket("");
    setSku("");
    setSource("");
    setPage(1);
  }, []);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  // 코멘트 실시간 갱신 — MarketSourceDebug 저장 callback에서 호출
  const handleCommentSaved = useCallback((pid: number, savedNote: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.pid === pid
            ? { ...it, hasComment: savedNote.trim().length > 0, commentPreview: savedNote.slice(0, 100), commentUpdatedAt: new Date().toISOString() }
            : it,
        ),
      };
    });
  }, []);

  const totalPages = data?.totalPages ?? 1;
  const pageNumbers = (() => {
    const max = Math.min(totalPages, 10);
    const start = Math.max(1, Math.min(page - 4, totalPages - max + 1));
    return Array.from({ length: max }, (_, i) => start + i);
  })();

  return (
    <section className="space-y-4 px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#3182f6] dark:text-blue-400">Admin · candidate_pool</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">운영자 풀 매물 검증</h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              팩 결제 없이 candidate_pool 전체 매물 페이지네이션 조회. 카드별 시세 근거 디버그 가능.
            </p>
          </div>
          {data && (
            <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
              필터 결과 {data.total.toLocaleString()}건 / {data.totalPages}페이지
            </div>
          )}
        </div>

        {/* Pool 전체 stats — band × status breakdown */}
        {stats && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="mb-2 flex items-baseline justify-between">
              <div className="font-bold text-zinc-700 dark:text-zinc-200">📊 풀 전체 (모든 status)</div>
              <div className="font-mono text-sm font-black text-zinc-900 dark:text-zinc-100">총 {stats.totalAll.toLocaleString()}건</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-zinc-500 dark:text-zinc-400">
                    <th className="py-1 pr-3"></th>
                    <th className="py-1 pr-3 text-right">band 1</th>
                    <th className="py-1 pr-3 text-right">band 2</th>
                    <th className="py-1 pr-3 text-right">band 3</th>
                    <th className="py-1 pl-3 text-right font-bold">합계</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {(["ready", "invalidated", "spent"] as const).map((s) => (
                    <tr key={s} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1 pr-3 font-sans font-semibold text-zinc-700 dark:text-zinc-200">
                        {s === "ready" ? "🟢 ready" : s === "invalidated" ? "⚫ invalidated" : "🔵 spent"}
                      </td>
                      <td className="py-1 pr-3 text-right tabular-nums">{(stats.byBandStatus[`band1_${s}`] ?? 0).toLocaleString()}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{(stats.byBandStatus[`band2_${s}`] ?? 0).toLocaleString()}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{(stats.byBandStatus[`band3_${s}`] ?? 0).toLocaleString()}</td>
                      <td className="py-1 pl-3 text-right tabular-nums font-bold text-zinc-900 dark:text-zinc-100">{(stats.totals[s] ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">stats는 page 1 로드 시만 fetch (DB I/O 절약).</div>
          </div>
        )}

        {stats && (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="mb-2 font-bold text-zinc-700 dark:text-zinc-200">출처별 ready</div>
              <div className="flex flex-wrap gap-1.5">
                {stats.bySource.map((row) => (
                  <button
                    key={row.source}
                    type="button"
                    onClick={() => { setSource(row.source); setPage(1); }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-black text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <MarketplaceSourceBadge source={row.source} label={row.label} />
                    <span className="font-mono">{row.ready_count.toLocaleString()}</span>
                  </button>
                ))}
                {stats.bySource.length === 0 ? (
                  <span className="text-[11px] text-zinc-400">ready 출처 집계 없음</span>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-bold text-zinc-700 dark:text-zinc-200">가격대별 ready</div>
                {priceBucket ? (
                  <button
                    type="button"
                    onClick={() => { setPriceBucket(""); setPage(1); }}
                    className="text-[10px] font-black text-blue-700 hover:underline dark:text-blue-300"
                  >
                    가격 필터 해제
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stats.byPriceBucket.map((bucket) => (
                  <button
                    key={bucket.key}
                    type="button"
                    onClick={() => { setPriceBucket(bucket.key); setPage(1); }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-black transition ${
                      priceBucket === bucket.key
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    {bucket.label} <span className="font-mono">{bucket.ready_count.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {stats && (
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-bold text-zinc-700 dark:text-zinc-200">카테고리별 ready</div>
                {category ? (
                  <button
                    type="button"
                    onClick={() => { setCategory(""); setPage(1); }}
                    className="text-[10px] font-black text-blue-700 hover:underline dark:text-blue-300"
                  >
                    카테고리 해제
                  </button>
                ) : null}
              </div>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {stats.byCategory.map((row) => (
                  <button
                    key={row.category}
                    type="button"
                    onClick={() => { setCategory(row.category); setPage(1); }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-black transition ${
                      category === row.category
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    {categoryLabel(row.category)} <span className="font-mono">{row.ready_count.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Wave 176 (2026-05-17): 매물명/SKU명/comparable_key/pid 통합 검색. Enter 또는 🔍 클릭. */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <div className="relative flex items-center">
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
              placeholder="🔍 매물명/SKU/pid 검색 (예: 327, Gazelle, shoe|nb)"
              className="w-72 rounded-md border border-zinc-300 bg-white px-2 py-1 pr-7 dark:border-zinc-700 dark:bg-zinc-800"
            />
            {searchDraft && (
              <button
                type="button"
                onClick={clearSearch}
                title="검색 지우기"
                className="absolute right-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={applySearch}
            disabled={loading}
            className="rounded-md border border-blue-700 bg-blue-700 px-3 py-1 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            검색
          </button>
          {searchQuery && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              검색: &quot;{searchQuery}&quot;
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
            {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <select value={band} onChange={(e) => { setBand(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">band 전체</option>
            <option value="1">band 1</option>
            <option value="2">band 2</option>
            <option value="3">band 3</option>
          </select>
          {stats && stats.bySource.length > 0 && (
            <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
              <option value="">출처 전체</option>
              {stats.bySource.map((row) => (
                <option key={row.source} value={row.source}>
                  {row.label} — {row.ready_count}건
                </option>
              ))}
            </select>
          )}
          {stats && stats.byPriceBucket.length > 0 && (
            <select value={priceBucket} onChange={(e) => { setPriceBucket(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
              <option value="">가격대 전체</option>
              {stats.byPriceBucket.map((bucket) => (
                <option key={bucket.key} value={bucket.key}>
                  {bucket.label} — {bucket.ready_count}건
                </option>
              ))}
            </select>
          )}
          {stats && stats.byCategory.length > 0 && (
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
              <option value="">카테고리 전체 ({stats.byCategory.length}종)</option>
              {stats.byCategory.map((row) => (
                <option key={row.category} value={row.category}>
                  {categoryLabel(row.category)} — {row.ready_count}건
                </option>
              ))}
            </select>
          )}
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
            {SORT_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          {stats && stats.bySku.length > 0 && (
            <select value={sku} onChange={(e) => { setSku(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
              <option value="">SKU 전체 ({stats.bySku.length}종)</option>
              {stats.bySku.map((s) => (
                <option key={s.sku_id} value={s.sku_id}>
                  {s.sku_name ?? s.sku_id} — {s.ready_count}건
                </option>
              ))}
            </select>
          )}
          <button onClick={fetchPage} disabled={loading} className="rounded-md border border-zinc-300 bg-white px-3 py-1 font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
            {loading ? "..." : "↻ 새로고침"}
          </button>
          {(band || category || priceBucket || sku) && (
            <button onClick={clearPoolFilters} disabled={loading} className="rounded-md border border-zinc-300 bg-white px-3 py-1 font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">에러: {error}</div>}

      {/* 첫 로딩 스켈레톤 — data 없을 때만 (refresh 시에는 기존 data 유지) */}
      {loading && !data && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse gap-3 rounded-lg border border-[#e3ddd2] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="h-[100px] w-[100px] shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-5 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((item) => (
              <article
                key={item.pid}
                className={`relative rounded-lg border bg-white p-3 shadow-sm dark:bg-zinc-900 ${
                  item.hasComment
                    ? "border-blue-400 ring-2 ring-blue-200 dark:border-blue-700 dark:ring-blue-900/40"
                    : "border-[#e3ddd2] dark:border-zinc-800"
                }`}
              >
                {item.hasComment && (
                  <div className="absolute right-2 top-2 z-10 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white shadow-md">
                    ✅ 코멘트
                  </div>
                )}
                <div className="flex gap-3">
                  {item.thumbnailUrl ? (
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.name}
                      width={100}
                      height={100}
                      unoptimized
                      className="h-[100px] w-[100px] shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-[100px] w-[100px] shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1 text-xs">
                    <div className="line-clamp-2 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black tabular-nums text-blue-700 dark:text-blue-400">
                        {item.expectedProfitMin === item.expectedProfitMax
                          ? `+${krw(item.expectedProfitMax)}`
                          : `+${krw(item.expectedProfitMin)}~${krw(item.expectedProfitMax)}`}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">band {item.band}</span>
                      {/* Wave 714d (2026-05-23 fix): 신발/의류는 기존 ConditionChip 숨김 (전자기기용이라 정확도 낮음).
                          신발/의류 = 새 ConditionTierChip (5-tier) 만 / 전자기기 = 기존 ConditionChip 그대로. */}
                      {item.category !== "shoe" && item.category !== "clothing" && (
                        <ConditionChip conditionClass={item.conditionClass} showHelp />
                      )}
                      {/* Wave 727 (2026-05-23): 신발/의류 condition_tier NULL 비율 추적 — DB 측정 결과 신발 65% / 의류 79% NULL.
                          운영자 화면에서 NULL placeholder 박아 backfill 진행 상황 가시화. 사용자 화면 3곳은 다른 세션 종료 후 별도 wave. */}
                      {(item.category === "shoe" || item.category === "clothing") && (
                        item.conditionTier ? (
                          <ConditionTierChip
                            tier={item.conditionTier}
                            showHelp
                            category={item.category === "clothing" ? "clothing" : "shoe"}
                          />
                        ) : (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            등급 NULL
                          </span>
                        )
                      )}
                    </div>
                    {/* Wave 714d: raw 표현 chips (박스/하자/실착 등) */}
                    {item.conditionChips && item.conditionChips.length > 0 && (
                      <ConditionChipsList chips={item.conditionChips} max={5} className="mt-0.5" />
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-700 dark:text-zinc-300">
                      <span>매입 {krw(item.price)}</span>
                      {/* Wave 246 (2026-05-19): skuMedian=0/null 가드 — "시세 0원" 미스리딩 차단.
                         16% 매물에 sku_median=0 (production 측정). band-aware market median이
                         있어도 mvp_listings.sku_median은 별도 path라 0일 수 있음. 0이면
                         사용자 명시 정책 (b): "표시 안 함" — 시세 확인중 안내로 대체. */}
                      {item.skuMedian && item.skuMedian > 0 ? (
                        <span>· 시세 {krw(item.skuMedian)}</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" title="시세 표본이 아직 부족하거나 갱신중 — 차익은 추정치">
                          시세 확인중
                        </span>
                      )}
                      <span>· 신뢰 {(item.confidence * 100).toFixed(0)}%</span>
                      {/* Wave 329: 헤드라인 차익(expectedProfitMin/Max 평균)을 그대로 사용 — 가이드와 일치 */}
                      {(() => {
                        // Wave launch-3: 단일 출처 VERDICT_LABELS 사용 (3 화면 통일).
                        const avgProfit = Math.round((item.expectedProfitMin + item.expectedProfitMax) / 2);
                        const guidance = buyPriceGuidance({ price: item.price, currentProfit: avgProfit });
                        if (!guidance) return null;
                        const label = verdictUiLabel(guidance.verdict);
                        if (!label) return null;
                        const cls = label.tone === "em"
                          ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                          : label.tone === "amber"
                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                            : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200";
                        return (
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${cls}`}
                            title={`차익 +${krw(guidance.currentProfit)} · 협상 시도 ${krw(guidance.negotiationTarget)} / ${krw(guidance.breakEven)} 이상에 사면 손해`}
                          >
                            {label.card}
                          </span>
                        );
                      })()}
                      {/* Wave launch-17 (3 화면 일관성): 가품 위험 chip — high counterfeit brand 만. */}
                      {(() => {
                        const category = categoryFromComparableKey(item.comparableKey ?? null);
                        const brandDepth = detectBrandDepth(category, {
                          skuId: item.skuId ?? null,
                          skuName: item.skuName ?? null,
                          name: item.name ?? null,
                        });
                        if (!brandDepth || brandDepth.brand.counterfeitRisk !== "high") return null;
                        return (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60"
                            title={`${brandDepth.brand.label} = 가품 위험 큰 브랜드`}
                          >
                            <span aria-hidden="true">⚠</span>
                            <span>정품 확인</span>
                          </span>
                        );
                      })()}
                      {/* Wave 182 Phase 3 (2026-05-17): base option fallback 정직성 표시.
                          매물 텍스트에 옵션 명시 X → SKU 기본 옵션 가정. 시세는 base 기준 (보수적). */}
                      {item.optionBaseAssumed && item.optionBaseAssumed.length > 0 ? (
                        <span
                          title={`이 매물은 ${item.optionBaseAssumed.join(", ")} 명시 안 됨 → SKU 기본 옵션 가정 시세로 계산. 실제 매물이 고옵션이면 차익이 더 클 수 있어요.`}
                          className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        >
                          기본 옵션 가정
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <MarketplaceSourceBadge source={item.marketplaceSource} label={item.marketplaceLabel} />
                      <span>{item.skuName ?? "—"} · {item.poolStatus} · {relAge(item.lastVerifiedAt)} · 노출 {item.exposureCount}/{item.maxExposure}</span>
                      {(() => {
                        const stale = verifiedAtStaleness(item.lastVerifiedAt);
                        if (!stale) return null;
                        const cls = stale.tone === "danger"
                          ? "border border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                          : "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200";
                        return (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${cls}`}>
                            {stale.label}
                          </span>
                        );
                      })()}
                    </div>
                    {/* 2026-05-17 Phase 0 L4: RiskScoreBar — 5축 잔여 위험 신호 시각화. 운영자풀은 showDetail. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskScoreBar
                        scoreFlags={item.scoreFlags}
                        descriptionPreview={item.descriptionPreview}
                        conditionClass={item.conditionClass}
                        categorySlug={item.category}
                        price={item.price}
                        skuMedian={item.skuMedian}
                        confidence={item.confidence}
                        sellerReviewRating={item.sellerReviewRating}
                        sellerReviewCount={item.sellerReviewCount}
                        photoCount={item.imageCount}
                        showDetail
                      />
                      {/* Wave 187 (2026-05-17): L6 Liquidity 곡선 compact chip — pack-reveal 과 동일 utility 재사용. */}
                      <LiquidityCurveMini
                        price={item.price}
                        p25Price={item.marketP25Price}
                        medianPrice={item.marketMedianPrice}
                        p75Price={item.marketP75Price}
                        p25Hours={item.velocityP25Hours}
                        medianHours={item.velocityMedianHours}
                        p75Hours={item.velocityP75Hours}
                        soldSampleCount={item.velocitySoldSampleCount}
                        compact
                      />
                    </div>
                    {/* 2026-05-17 Phase 2: verdict chips (근거 강조) — 가능한 input 만 buildVerdicts. */}
                    {(() => {
                      const verdicts = buildVerdicts({
                        price: item.price,
                        skuMedian: item.skuMedian,
                        expectedProfitMin: item.expectedProfitMin,
                        expectedProfitMax: item.expectedProfitMax,
                        confidence: item.confidence,
                        lastSeenAt: item.lastSeenAt,
                      });
                      return verdicts.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {verdicts.map((v) => (
                            <span
                              key={v.label}
                              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${VERDICT_TONE_CLASS[v.tone]}`}
                            >
                              {v.label}
                            </span>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    {/* 2026-05-16 (사용자 코멘트 #120): 시세 출처 표시 — pack-reveal-modal 과 동일 패턴. */}
                    {/* Wave 246 (2026-05-19): skuMedian=0 일 땐 출처 배지 숨김 — 시세 자체가 없는데 출처만 보이면 미스리딩. */}
                    {!(item.skuMedian && item.skuMedian > 0) ? null : item.conditionClass === "unopened" ? (
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        <DanawaLogo className="h-4 w-4 rounded-[4px]" />
                        다나와 새 가격 기준 (이 매물 미개봉)
                      </div>
                    ) : item.conditionClass === "mint" ? (
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-200">
                        <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-zinc-900 text-[8px] font-black text-white dark:bg-zinc-100 dark:text-zinc-900">
                          통
                        </span>
                        통합 S급 매물 median
                      </div>
                    ) : item.conditionClass ? (
                      <div className="inline-flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                        <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-zinc-900 text-[8px] font-black text-white dark:bg-zinc-100 dark:text-zinc-900">
                          통
                        </span>
                        통합 중고 매물 median ({item.conditionClass})
                      </div>
                    ) : null}
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      <span className="font-mono">{item.skuId ?? "—"}</span> · query: {item.query ?? "—"}
                    </div>
                    {item.listingUrl ? (
                      <a href={item.listingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400">
                        <MarketplaceSourceBadge source={item.marketplaceSource} label={item.marketplaceLabel} />
                        열기
                      </a>
                    ) : null}
                  </div>
                </div>
                {item.hasComment && item.commentPreview && (
                  <div className="mt-2 rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                    <div className="line-clamp-2">💬 {item.commentPreview}</div>
                  </div>
                )}
                {/* 2026-05-16 (사용자 코멘트 #110 후속): 헷갈림 안내 (catalog Sku.confusionNote). admin pool 도 표시. */}
                {(() => {
                  const note = item.skuId
                    ? CATALOG.find((sku) => sku.id === item.skuId)?.confusionNote
                    : null;
                  return note ? (
                    <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                      <span className="mr-1">💡</span>
                      {note}
                    </div>
                  ) : null;
                })()}
                {/* 운영자풀은 카드가 많아 자동 그래프 로드 시 /api/market/history rate limit에 걸린다. */}
                <div className="mt-2">
                  <MarketHistoryChart comparableKey={item.comparableKey} currentPrice={item.price} lazy />
                </div>
                <div className="mt-2">
                  <MarketSourceDebug
                    pid={item.pid}
                    ourPrice={item.price}
                    initialNote={item.commentPreview}
                    onCommentSaved={handleCommentSaved}
                  />
                </div>
              </article>
            ))}
            {data.items.length === 0 && (
              <div className="col-span-full rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                조건에 맞는 매물 없음
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          <div className="flex flex-wrap items-center justify-center gap-1 py-2">
            <button onClick={() => setPage(1)} disabled={page === 1 || loading} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800">«</button>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || loading} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800">‹</button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                disabled={loading}
                className={`rounded-md border px-3 py-1 text-xs font-semibold ${n === page ? "border-blue-700 bg-blue-700 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}
              >
                {n}
              </button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages || loading} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800">»</button>
          </div>
        </>
      )}
    </section>
  );
}
