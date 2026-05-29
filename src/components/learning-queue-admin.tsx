"use client";

// Wave 244 (2026-05-19): learning queue admin UI client component.
//
// 측정 카드 + queue 테이블. /admin/learning-queue 진입 후 fetch.
// 디자인: /admin/explore-monitor 패턴 + classification-browser 의 카드 스타일.

import { useCallback, useEffect, useState } from "react";

type Coverage = { totalReady: number; aiSeen: number; aiSeenPct: number | null };
type Stats = {
  coverage: { today: Coverage; last7d: Coverage; thisMonth: Coverage };
  cost: { today: number; thisMonth: number; last30dAll: number };
  callRateMonthly: Array<{ month: string; totalReady: number; aiSeen: number; aiSeenPct: number | null }>;
  queue: {
    byStatus: Record<string, number>;
    falsePositive: number;
    topSkus: Array<{ sku_id: string; totalFrequency: number }>;
  };
  generatedAt: string;
};

type Sample = {
  pid: number;
  name: string | null;
  price: number | null;
  url: string | null;
  thumbnail_url: string | null;
  last_seen_at: string | null;
};

type QueueItem = {
  id: number;
  skuId: string;
  skuName: string | null;
  pid: number;
  aiClassification: string;
  aiConfidence: number | null;
  aiReason: string | null;
  suggestedMustNotContain: string[];
  matchedText: string;
  frequencyCount: number;
  status: string;
  falsePositive: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  appliedAt: string | null;
  appliedToCommit: string | null;
  createdAt: string;
  updatedAt: string;
  samples: Sample[];
};

type ListResp = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: QueueItem[];
};

const krw = (v: number | null | undefined) => v == null ? "—" : `₩${Math.round(v).toLocaleString("ko-KR")}`;
const pct = (v: number | null | undefined) => v == null ? "—" : `${v.toFixed(1)}%`;
const usd = (v: number) => `$${v.toFixed(2)}`;

function relAge(iso: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 24) return `${h.toFixed(1)}시간 전`;
  return `${(h / 24).toFixed(1)}일 전`;
}

export default function LearningQueueAdmin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [list, setList] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [freqMin, setFreqMin] = useState(3);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionBusy, setActionBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch("/api/admin/learning-queue/stats", { cache: "no-store" }),
        fetch(`/api/admin/learning-queue?freq=${freqMin}&status=${statusFilter}&page=${page}&pageSize=20`, { cache: "no-store" }),
      ]);
      const statsJson = await statsRes.json();
      const listJson = await listRes.json();
      if (!statsRes.ok) throw new Error(statsJson.error ?? "stats failed");
      if (!listRes.ok) throw new Error(listJson.error ?? "list failed");
      setStats(statsJson as Stats);
      setList(listJson as ListResp);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [freqMin, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: number, skuId: string) => {
    if (!confirm(`SKU ${skuId} 패턴을 catalog patch 큐에 적재할까요?\n\n실제 코드 박힘은 별도 — admin 이 git PR 또는 수동 apply 후 학습 큐가 닫힘.`)) return;
    setActionBusy(id);
    try {
      const res = await fetch(`/api/admin/learning-queue/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-minyoi-admin-action": "1" },
        body: JSON.stringify({ patchType: "mustNotContain" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "approve_failed");
      await load();
    } catch (e) {
      alert(`approve 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionBusy(null);
    }
  };

  const reject = async (id: number) => {
    const reason = prompt("reject 사유 (선택, 300자 이내) — 같은 패턴 다시 큐 진입 X.");
    if (reason === null) return;
    setActionBusy(id);
    try {
      const res = await fetch(`/api/admin/learning-queue/${id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-minyoi-admin-action": "1" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "reject_failed");
      await load();
    } catch (e) {
      alert(`reject 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">학습 큐 (AI L2 → catalog 패치 후보)</h1>
          <p className="mt-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            AI 가 reject/hold 한 매물에서 추출한 catalog 패턴 후보. approve 시 pending_patches 큐 적재 (자동 박힘 X).
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "로딩..." : "새로고침"}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {stats ? (
        <>
          {/* 측정 카드 (coverage) */}
          <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI L2 coverage (ready 풀)</h2>
            <p className="mt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              baseline (2026-05-19): 91.1% AI 안 봄. 목표: 3개월 50% / 6개월 90%+ catalog 자동 분류.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label="오늘 AI 본 비율"
                value={pct(stats.coverage.today.aiSeenPct)}
                sub={`${stats.coverage.today.aiSeen} / ${stats.coverage.today.totalReady} 매물`}
                tone="info"
              />
              <Stat
                label="최근 7일"
                value={pct(stats.coverage.last7d.aiSeenPct)}
                sub={`${stats.coverage.last7d.aiSeen} / ${stats.coverage.last7d.totalReady} 매물`}
                tone="info"
              />
              <Stat
                label="이번 달"
                value={pct(stats.coverage.thisMonth.aiSeenPct)}
                sub={`${stats.coverage.thisMonth.aiSeen} / ${stats.coverage.thisMonth.totalReady} 매물`}
                tone="emerald"
              />
            </div>
            {stats.callRateMonthly.length > 0 ? (
              <div className="mt-4">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  월별 AI 호출 비율 (catalog 학습되면 ↓ 되는 게 목표)
                </div>
                <div className="space-y-1">
                  {stats.callRateMonthly.map((row) => (
                    <div key={row.month} className="flex items-center gap-3">
                      <div className="w-16 shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {row.month}
                      </div>
                      <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="absolute inset-y-0 left-0 bg-sky-500"
                          style={{ width: `${row.aiSeenPct ?? 0}%` }}
                        />
                      </div>
                      <div className="w-16 shrink-0 text-right text-xs font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {pct(row.aiSeenPct)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {/* 측정 카드 (cost + queue summary) */}
          <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">누적 비용 (Anthropic API)</h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Stat label="오늘" value={usd(stats.cost.today)} tone="zinc" />
                <Stat label="이번 달" value={usd(stats.cost.thisMonth)} tone="info" />
                <Stat label="최근 30일" value={usd(stats.cost.last30dAll)} tone="info" />
              </div>
              <p className="mt-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                AI_L2_DAILY_BUDGET_USD env cap 적용 (default $10/일). 초과 시 자동 disable + telegram alert.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">큐 상태</h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Stat label="pending" value={`${stats.queue.byStatus.pending ?? 0}`} tone="info" />
                <Stat label="approved" value={`${stats.queue.byStatus.approved ?? 0}`} tone="emerald" />
                <Stat label="rejected (false positive)" value={`${stats.queue.byStatus.rejected ?? 0}`} tone="rose" />
              </div>
              <p className="mt-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                rejected = false_positive=true 박힘 → 같은 (sku/패턴) 다시 큐 진입 X.
              </p>
            </div>
          </section>
        </>
      ) : null}

      {/* 필터 */}
      <section className="mb-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <div className="mb-1 font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">freq (최소)</div>
            <input
              type="number"
              min={1}
              value={freqMin}
              onChange={(e) => { setPage(1); setFreqMin(Math.max(1, Number(e.target.value) || 1)); }}
              className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">status</div>
            <select
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="all">all</option>
            </select>
          </label>
          {list ? (
            <div className="ml-auto text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {list.total.toLocaleString("ko-KR")} 패턴 · {list.totalPages} 페이지
            </div>
          ) : null}
        </div>
      </section>

      {/* 큐 테이블 */}
      <section className="space-y-3">
        {list?.items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
            현재 조건에 매칭되는 큐가 없어요. freq 를 낮추거나 status 를 바꿔보세요.
          </div>
        ) : null}
        {list?.items.map((item) => (
          <article key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {item.skuName ?? item.skuId}
                  </h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {item.skuId}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.aiClassification === "reject"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}>
                    AI {item.aiClassification}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  <span>frequency: <b className="text-zinc-800 dark:text-zinc-200">{item.frequencyCount}</b></span>
                  <span>matched_text: <code className="rounded bg-zinc-100 px-1.5 dark:bg-zinc-800">{item.matchedText.slice(0, 60)}</code></span>
                  <span>confidence: {item.aiConfidence != null ? item.aiConfidence.toFixed(2) : "—"}</span>
                  <span>added: {relAge(item.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => approve(item.id, item.skuId)}
                      disabled={actionBusy === item.id || item.suggestedMustNotContain.length === 0}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
                      title={item.suggestedMustNotContain.length === 0 ? "패턴 없음 — approve 불가" : ""}
                    >
                      approve → patch 큐
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(item.id)}
                      disabled={actionBusy === item.id}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-40"
                    >
                      reject (false positive)
                    </button>
                  </>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.status === "approved"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}>
                    {item.status} · {item.reviewedBy ?? "—"}
                  </span>
                )}
              </div>
            </div>

            {/* suggested mustNotContain */}
            {item.suggestedMustNotContain.length > 0 ? (
              <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-950/30">
                <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  suggested mustNotContain (AI reason 기반)
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {item.suggestedMustNotContain.map((kw, idx) => (
                    <code key={idx} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      {kw}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}

            {/* AI reason */}
            {item.aiReason ? (
              <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-950/30">
                <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  AI reason
                </div>
                <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">{item.aiReason}</p>
              </div>
            ) : null}

            {/* sample pids */}
            {item.samples.length > 0 ? (
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  sample 매물 (최근 {item.samples.length}건 · 직접 검증)
                </div>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {item.samples.map((sample) => (
                    <a
                      key={sample.pid}
                      href={sample.url ?? `https://m.bunjang.co.kr/products/${sample.pid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block overflow-hidden rounded-lg border border-zinc-200 transition hover:border-blue-300 hover:shadow-sm dark:border-zinc-800 dark:hover:border-blue-700"
                    >
                      {sample.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sample.thumbnail_url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="aspect-square w-full bg-zinc-100 dark:bg-zinc-800" />
                      )}
                      <div className="px-2 py-1.5">
                        <div className="line-clamp-2 text-[11px] font-medium text-zinc-800 group-hover:text-blue-700 dark:text-zinc-200 dark:group-hover:text-blue-300">
                          {sample.name ?? `pid ${sample.pid}`}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                          <span>{krw(sample.price)}</span>
                          <span>{relAge(sample.last_seen_at)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}

        {/* 페이지네이션 */}
        {list && list.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700"
            >
              이전
            </button>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {page} / {list.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(list.totalPages, page + 1))}
              disabled={page >= list.totalPages || loading}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700"
            >
              다음
            </button>
          </div>
        ) : null}
      </section>

      <div className="mt-6 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
        생성: {stats?.generatedAt ?? "—"}
      </div>
    </main>
  );
}

function Stat({ label, value, sub, tone }: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "info" | "emerald" | "rose" | "zinc";
}) {
  const valueColor = tone === "good" || tone === "emerald"
    ? "text-blue-600 dark:text-blue-300"
    : tone === "rose"
      ? "text-rose-600 dark:text-rose-300"
      : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
      {sub ? (
        <div className="mt-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{sub}</div>
      ) : null}
    </div>
  );
}
