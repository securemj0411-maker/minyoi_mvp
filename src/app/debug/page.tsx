import Link from "next/link";
import { DebugAutoRefresh } from "@/app/debug/debug-auto-refresh";
import { DebugResetPanel } from "@/app/debug/debug-reset-panel";
import { loadCollectRuns, type CollectRun } from "@/lib/collect-logs";

export const dynamic = "force-dynamic";

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatDuration(ms: number | null) {
  if (ms == null) return "진행 중";
  if (ms < 1000) return `${ms}ms`;
  return `${Math.round(ms / 100) / 10}초`;
}

function elapsedMs(run: CollectRun) {
  return Math.max(0, Date.now() - Date.parse(run.startedAt));
}

function isStaleRunning(run: CollectRun) {
  return run.status === "running" && elapsedMs(run) > 3 * 60 * 1000;
}

function statusLabel(run: CollectRun) {
  if (isStaleRunning(run)) return "멈춤 의심";
  const status = run.status;
  if (status === "succeeded") return "완료";
  if (status === "failed") return "실패";
  return "진행 중";
}

function statusClass(run: CollectRun) {
  if (isStaleRunning(run)) return "bg-red-100 text-red-800 ring-red-200";
  const status = run.status;
  if (status === "succeeded") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-800 ring-red-200";
  return "bg-amber-100 text-amber-800 ring-amber-200";
}

function durationLabel(run: CollectRun) {
  if (run.durationMs != null) return formatDuration(run.durationMs);
  if (run.status === "running") {
    const elapsed = elapsedMs(run);
    if (elapsed >= 60 * 1000) return `${Math.floor(elapsed / 60000)}분 경과`;
    return `${Math.max(1, Math.floor(elapsed / 1000))}초 경과`;
  }
  return "-";
}

function num(value: number) {
  return value.toLocaleString("ko-KR");
}

function shortText(value: string | null, max = 42) {
  if (!value) return "-";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function pct(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function restUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

function kstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

type MarketPriceDebugRow = {
  comparable_key: string;
  active_sample_count: number;
  confidence: "high" | "medium" | "low";
  active_median_price: number | null;
};

async function loadMarketPriceDebug() {
  const base = restUrl();
  const headers = serviceHeaders();
  if (!base || !headers) {
    return {
      date: kstDateString(),
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
      totalSamples: 0,
      top: [] as MarketPriceDebugRow[],
    };
  }
  const today = kstDateString();
  const url = `${base}/mvp_market_price_daily?select=comparable_key,active_sample_count,confidence,active_median_price&date=eq.${today}&order=active_sample_count.desc&limit=1000`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    return {
      date: today,
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
      totalSamples: 0,
      top: [] as MarketPriceDebugRow[],
    };
  }
  const rows = (await res.json()) as MarketPriceDebugRow[];
  return {
    date: today,
    total: rows.length,
    high: rows.filter((row) => row.confidence === "high").length,
    medium: rows.filter((row) => row.confidence === "medium").length,
    low: rows.filter((row) => row.confidence === "low").length,
    totalSamples: rows.reduce((sum, row) => sum + Number(row.active_sample_count ?? 0), 0),
    top: rows.slice(0, 5),
  };
}

function lastSucceeded(runs: CollectRun[]) {
  return runs.find((run) => run.status === "succeeded") ?? null;
}

function stageStats(run: CollectRun, stage: "search" | "detail" | "score") {
  const stages = run.stageStats.stages;
  if (!stages || typeof stages !== "object") return null;
  const value = (stages as Record<string, unknown>)[stage];
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function stageDuration(run: CollectRun, stage: "search" | "detail" | "score") {
  const durations = run.stageStats.stageDurationsMs;
  if (!durations || typeof durations !== "object") return null;
  const value = (durations as Record<string, unknown>)[stage];
  return typeof value === "number" ? value : null;
}

function stageValue(stats: Record<string, unknown> | null, key: string) {
  const value = stats?.[key];
  return typeof value === "number" ? value : 0;
}

function stageTimedOut(stats: Record<string, unknown> | null) {
  return stats?.timedOut === true;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-950">{value}</div>
      {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function StagePanel({ run }: { run: CollectRun }) {
  const rows = [
    {
      key: "search" as const,
      label: "검색",
      primary: "수집",
      primaryKey: "collected",
      secondary: "큐 적재",
      secondaryKey: "queued",
    },
    {
      key: "detail" as const,
      label: "상세",
      primary: "claim",
      primaryKey: "claimed",
      secondary: "enrich",
      secondaryKey: "enriched",
    },
    {
      key: "score" as const,
      label: "점수",
      primary: "계산",
      primaryKey: "scored",
      secondary: "저장",
      secondaryKey: "upserted",
    },
  ];

  if (!run.stageStats.stages) return null;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="text-sm font-semibold text-zinc-950">Stage 예산</div>
      <div className="mt-1 text-xs text-zinc-500">
        tick이 search/detail/score를 시간 예산 안에서 어디까지 처리했는지 봅니다.
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {rows.map((row) => {
          const stats = stageStats(run, row.key);
          const duration = stageDuration(run, row.key);
          return (
            <div key={row.key} className="rounded-md border border-zinc-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-950">{row.label}</div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                  stageTimedOut(stats)
                    ? "bg-amber-100 text-amber-800 ring-amber-200"
                    : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                }`}>
                  {stageTimedOut(stats) ? "budget stop" : "완료"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MetricCard label={row.primary} value={`${num(stageValue(stats, row.primaryKey))}건`} />
                <MetricCard label={row.secondary} value={`${num(stageValue(stats, row.secondaryKey))}건`} />
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                소요 {duration == null ? "-" : formatDuration(duration)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowBar({ run }: { run: CollectRun }) {
  const steps = [
    { label: "검색 수집", value: run.collectedCount, total: run.collectedCount },
    { label: "제목 룰 통과", value: run.titleNormalCount, total: run.collectedCount },
    { label: "상세 enrich", value: run.enrichedCount, total: run.titleNormalCount },
    { label: "점수 계산", value: run.scoredCount, total: Math.max(run.scoredCount, run.enrichedCount) },
    { label: "최종 upsert", value: run.upsertedCount, total: run.scoredCount },
  ];

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950">최근 수집 흐름</div>
          <div className="text-xs text-zinc-500">{formatTime(run.startedAt)} 시작 · {durationLabel(run)}</div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(run)}`}>
          {statusLabel(run)}
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {steps.map((step) => (
          <div key={step.label} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_90px] sm:items-center">
            <div className="text-sm font-medium text-zinc-700">{step.label}</div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-950"
                style={{ width: pct(step.value, Math.max(1, step.total)) }}
              />
            </div>
            <div className="text-sm text-zinc-600 sm:text-right">
              {num(step.value)}건
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiPanel({ run }: { run: CollectRun }) {
  const skippedByCondition = Math.max(0, run.scoredCount - run.aiReviewRequested);
  const aiHandled = run.aiCacheHits + run.aiApiCalls;
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="text-sm font-semibold text-zinc-950">OpenAI 검토</div>
      <div className="mt-1 text-xs text-zinc-500">
        룰로 충분한 후보는 AI 비용 없이 패스하고, 상위권 애매 후보만 확인합니다.
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="조건 패스" value={`${num(skippedByCondition)}건`} sub="AI 호출 없이 통과" />
        <MetricCard label="AI 검토 대상" value={`${num(run.aiReviewRequested)}건`} sub={`점수 계산 ${num(run.scoredCount)}건 중`} />
        <MetricCard label="실제 API 호출" value={`${num(run.aiApiCalls)}건`} sub={`캐시 ${num(run.aiCacheHits)}건`} />
        <MetricCard label="AI가 제외" value={`${num(run.aiFilteredCount)}건`} sub={`처리됨 ${num(aiHandled)}건 중`} />
      </div>
      {run.aiUnavailableCount > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          AI 검토 불가 {num(run.aiUnavailableCount)}건. Vercel `OPENAI_API_KEY` 또는 API timeout을 확인해야 합니다.
        </div>
      ) : null}
    </div>
  );
}

function MarketStatsPanel({ stats }: { stats: Awaited<ReturnType<typeof loadMarketPriceDebug>> }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="text-sm font-semibold text-zinc-950">시세 통계 품질</div>
      <div className="mt-1 text-xs text-zinc-500">
        후보팩은 comparable_key 시세가 medium/high인 매물만 통과시킵니다.
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="오늘 시세키" value={`${num(stats.total)}개`} sub={stats.date} />
        <MetricCard label="High" value={`${num(stats.high)}개`} sub="표본 20건+" />
        <MetricCard label="Medium" value={`${num(stats.medium)}개`} sub="표본 8건+" />
        <MetricCard label="Low" value={`${num(stats.low)}개`} sub={`총 표본 ${num(stats.totalSamples)}건`} />
      </div>
      <div className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-100">
        {stats.top.map((row) => (
          <div key={row.comparable_key} className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_80px_80px_80px] sm:items-center">
            <div className="truncate font-mono text-zinc-700">{row.comparable_key}</div>
            <div className="text-zinc-500 sm:text-right">{num(row.active_sample_count)}건</div>
            <div className="font-semibold text-zinc-700 sm:text-right">{row.confidence}</div>
            <div className="text-zinc-700 sm:text-right">{num(Number(row.active_median_price ?? 0))}원</div>
          </div>
        ))}
        {stats.top.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">아직 오늘 시세 통계가 없습니다.</div>
        ) : null}
      </div>
    </div>
  );
}

function RequestPanel({ run }: { run: CollectRun }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950">요청 출발 정보</div>
          <div className="mt-1 text-xs text-zinc-500">
            cron-job.org/Vercel 경유 여부를 확인하기 위한 운영 메타입니다.
          </div>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
          {run.responseMode === "sync_wait" ? "동기 실행" : "백그라운드"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">출발</div>
          <div className="font-medium text-zinc-950">{shortText(run.triggerSource, 88)}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">IP</div>
          <div className="font-mono text-xs text-zinc-800">{run.requestIp ?? "-"}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">Host</div>
          <div className="font-mono text-xs text-zinc-800">{run.requestHost ?? "-"}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">Path</div>
          <div className="font-mono text-xs text-zinc-800">{run.requestPath ?? "-"}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">Vercel</div>
          <div className="font-mono text-xs text-zinc-800">{shortText(run.requestVercelId, 80)}</div>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
          <div className="text-zinc-500">인증</div>
          <div className={run.authOk ? "text-emerald-700" : "text-red-700"}>
            {run.authOk ? "통과" : "실패"} · {run.authReason ?? "-"}
          </div>
        </div>
      </div>
    </div>
  );
}

function CronTimeoutAdvice({ run }: { run: CollectRun }) {
  if (!run.waitMode || run.status !== "running") return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="font-semibold">cron-job.org 30초 timeout 가능성이 큽니다.</div>
      <div className="mt-1 text-amber-900">
        `wait=1` 전체 수집은 상세 enrich sleep만으로도 30초를 넘을 수 있어요. 디버깅 기간에는 아래처럼 가볍게 호출하는 게 안전합니다.
      </div>
      <code className="mt-3 block overflow-x-auto rounded-md bg-white px-3 py-2 text-xs text-zinc-900">
        /api/cron/collect?wait=1&amp;pages=1&amp;detailLimit=30&amp;aiTopN=0
      </code>
    </div>
  );
}

function RunsTable({ runs }: { runs: CollectRun[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="text-sm font-semibold text-zinc-950">최근 실행 내역</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500">
            <tr>
              <th className="px-4 py-3">시각</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">출발</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">모드</th>
              <th className="px-4 py-3">소요</th>
              <th className="px-4 py-3">검색</th>
              <th className="px-4 py-3">제목 통과</th>
              <th className="px-4 py-3">상세</th>
              <th className="px-4 py-3">AI 대상</th>
              <th className="px-4 py-3">API</th>
              <th className="px-4 py-3">캐시</th>
              <th className="px-4 py-3">AI 제외</th>
              <th className="px-4 py-3">저장</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {runs.map((run) => (
              <tr key={run.id} className="align-top">
                <td className="px-4 py-3 font-mono text-xs text-zinc-700">{formatTime(run.startedAt)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(run)}`}>
                    {statusLabel(run)}
                  </span>
                  {run.errorMessage ? <div className="mt-1 max-w-64 text-xs text-red-700">{run.errorMessage}</div> : null}
                </td>
                <td className="px-4 py-3 max-w-56 text-xs text-zinc-700">{shortText(run.triggerSource, 48)}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{run.requestIp ?? "-"}</td>
                <td className="px-4 py-3 text-xs text-zinc-700">
                  {run.responseMode === "sync_wait" ? "동기" : "백그라운드"}
                  {run.waitMode ? <div className="text-zinc-400">wait=1</div> : null}
                </td>
                <td className="px-4 py-3 text-zinc-700">{durationLabel(run)}</td>
                <td className="px-4 py-3">{num(run.collectedCount)}</td>
                <td className="px-4 py-3">{num(run.titleNormalCount)}</td>
                <td className="px-4 py-3">{num(run.enrichedCount)}</td>
                <td className="px-4 py-3">{num(run.aiReviewRequested)}</td>
                <td className="px-4 py-3">{num(run.aiApiCalls)}</td>
                <td className="px-4 py-3">{num(run.aiCacheHits)}</td>
                <td className="px-4 py-3">{num(run.aiFilteredCount)}</td>
                <td className="px-4 py-3 font-semibold">{num(run.upsertedCount)}</td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-10 text-center text-zinc-500">
                  아직 수집 실행 기록이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function DebugPage() {
  const runs = await loadCollectRuns(30);
  const marketStats = await loadMarketPriceDebug();
  const latest = runs[0] ?? null;
  const latestOk = lastSucceeded(runs);
  const totalApiCalls = runs.reduce((sum, run) => sum + run.aiApiCalls, 0);
  const totalAiFiltered = runs.reduce((sum, run) => sum + run.aiFilteredCount, 0);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">운영 로그</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              수집 파이프라인 상태
            </h1>
          </div>
          <Link
            href="/"
            className="w-fit rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
          >
            후보 화면으로
          </Link>
          <DebugAutoRefresh intervalSeconds={10} />
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="마지막 실행"
            value={latest ? formatTime(latest.startedAt) : "-"}
            sub={latest ? statusLabel(latest) : "기록 없음"}
          />
          <MetricCard
            label="마지막 성공"
            value={latestOk ? formatTime(latestOk.startedAt) : "-"}
            sub={latestOk ? `${num(latestOk.upsertedCount)}건 저장` : "성공 기록 없음"}
          />
          <MetricCard label="최근 AI API 호출" value={`${num(totalApiCalls)}건`} sub="최근 30회 합산" />
          <MetricCard label="AI 제외 누적" value={`${num(totalAiFiltered)}건`} sub="최근 30회 합산" />
        </section>

        {latest ? <CronTimeoutAdvice run={latest} /> : null}

        {latest ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px_420px]">
            <FlowBar run={latest} />
            <AiPanel run={latest} />
            <RequestPanel run={latest} />
          </section>
        ) : null}

        {latest ? <StagePanel run={latest} /> : null}

        <MarketStatsPanel stats={marketStats} />

        <DebugResetPanel />

        <RunsTable runs={runs} />
      </div>
    </main>
  );
}
