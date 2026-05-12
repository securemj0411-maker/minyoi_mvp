import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PackBand = 1 | 2 | 3;

type PackOpenDryRunResult = {
  pid: number;
  band: PackBand;
  category: string | null;
  key: string | null;
  name: string | null;
  price: number | null;
  decision: "reveal_cached" | "reveal_live" | "skip" | "error";
  reason: string;
  stale: boolean;
  liveChecked: boolean;
  lastVerifiedAt: string;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
};

type PackOpenDryRunReport = {
  generatedAt: string;
  sourceHealth: string;
  summary: Record<string, number>;
  bandSummaries: {
    band: PackBand;
    sampled: number;
    wouldReveal: number;
    targetCards: number;
    openLikely: boolean;
    liveChecked: number;
    stale: number;
  }[];
  reasons: { name: string; count: number }[];
  results: PackOpenDryRunResult[];
};

type PoolRow = {
  pid: number;
  profit_band: PackBand;
  status: "ready" | "reserved" | "revealed" | "invalidated" | string;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  last_verified_at: string | null;
  exposure_count: number | null;
  max_exposure: number | null;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional env file
  }
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function num(value: unknown) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function compact(value: unknown, length = 58) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function table(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function reasonGroup(reason: string) {
  if (reason === "fresh_cached" || reason === "live_verified") return "reveal_ok";
  if (reason.includes("sale_status_inactive")) return "sold_or_inactive_signal";
  if (reason.includes("fetch_failed")) return "detail_fetch_failed";
  if (reason.startsWith("live_sold_")) return "sold_signal_other";
  if (reason === "sale_status_inactive" || reason.includes("inactive")) return "inactive_or_lifecycle_stale";
  if (reason.startsWith("live_type_")) return "live_type_not_normal";
  if (reason.startsWith("live_error_")) return "live_fetch_error";
  if (reason === "side_only_earbud_title") return "title_noise";
  if (reason === "missing_listing_meta") return "pool_listing_mismatch";
  if (reason === "not_checked_detail_limit") return "diagnostic_limit";
  return reason;
}

function riskLevel(result: PackOpenDryRunResult, sourceHealth: string) {
  if (result.decision === "error") return "watch";
  if (result.reason.includes("fetch_failed") && sourceHealth === "healthy") return "fix_or_watch";
  if (result.reason.includes("fetch_failed")) return "watch";
  if (result.reason.includes("sale_status_inactive")) return "fix";
  if (result.reason.startsWith("live_sold_")) return "fix_or_watch";
  if (result.reason === "sale_status_inactive") return "fix";
  if (result.reason.startsWith("live_type_")) return "fix";
  if (result.reason === "missing_listing_meta") return "fix";
  if (result.reason === "side_only_earbud_title") return "fix";
  if (result.reason === "not_checked_detail_limit") return "observe";
  return "ok";
}

function dedupeExamples(rows: PackOpenDryRunResult[], limit = 20) {
  const seen = new Set<number>();
  const examples: PackOpenDryRunResult[] = [];
  for (const row of rows) {
    if (seen.has(row.pid)) continue;
    seen.add(row.pid);
    examples.push(row);
    if (examples.length >= limit) break;
  }
  return examples;
}

function renderMarkdown(report: {
  generatedAt: string;
  dryRunGeneratedAt: string;
  sourceHealth: string;
  summary: Record<string, number | string>;
  bandRows: {
    band: PackBand;
    sampled: number;
    reveal: number;
    skipped: number;
    error: number;
    openLikely: boolean;
    liveChecked: number;
    stale: number;
    activeReadyPool: number;
  }[];
  reasonGroups: { name: string; count: number }[];
  reasons: { name: string; count: number }[];
  actionRows: { action: string; count: number; note: string }[];
  examples: PackOpenDryRunResult[];
}) {
  return `${[
    "# Pack Open Quality Report",
    "",
    `- generated_at: ${report.generatedAt}`,
    `- dry_run_generated_at: ${report.dryRunGeneratedAt}`,
    `- source_health: ${report.sourceHealth}`,
    "",
    "## Summary",
    "",
    table(["metric", "value"], Object.entries(report.summary).map(([key, value]) => [key, value])),
    "",
    "## Band Health",
    "",
    table(
      ["band", "sampled", "reveal", "skip", "error", "open_likely", "live_checked", "stale", "active_ready_pool"],
      report.bandRows.map((row) => [
        row.band,
        row.sampled,
        row.reveal,
        row.skipped,
        row.error,
        row.openLikely ? "yes" : "no",
        row.liveChecked,
        row.stale,
        row.activeReadyPool,
      ]),
    ),
    "",
    "## Reason Groups",
    "",
    table(["group", "count"], report.reasonGroups.map((row) => [row.name, num(row.count)])),
    "",
    "## Raw Reasons",
    "",
    table(["reason", "count"], report.reasons.map((row) => [row.name, num(row.count)])),
    "",
    "## Suggested Actions",
    "",
    table(["action", "count", "note"], report.actionRows.map((row) => [row.action, num(row.count), row.note])),
    "",
    "## Examples To Inspect",
    "",
    table(
      ["risk", "band", "pid", "decision", "reason", "name", "price", "profit", "key"],
      report.examples.map((row) => [
        riskLevel(row, report.sourceHealth),
        row.band,
        row.pid,
        row.decision,
        row.reason,
        compact(row.name),
        num(row.price),
        `${num(row.expectedProfitMin)}~${num(row.expectedProfitMax)}`,
        compact(row.key, 44),
      ]),
    ),
    "",
  ].join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const dryRunPath = path.join(reportsDir, "pack-open-dry-run-latest.json");
  const dryRun = JSON.parse(await readFile(dryRunPath, "utf-8")) as PackOpenDryRunReport;
  const pool = await restJson<PoolRow[]>("/mvp_candidate_pool?select=pid,profit_band,status,category,comparable_key,expected_profit_min,expected_profit_max,last_verified_at,exposure_count,max_exposure&status=in.(ready,reserved)&limit=5000");

  const activeReadyByBand = new Map<PackBand, number>();
  for (const row of pool) {
    const maxExposure = Number(row.max_exposure ?? 0);
    const exposure = Number(row.exposure_count ?? 0);
    if (row.status !== "ready" || exposure >= maxExposure) continue;
    activeReadyByBand.set(row.profit_band, (activeReadyByBand.get(row.profit_band) ?? 0) + 1);
  }

  const results = dryRun.results;
  const revealed = results.filter((row) => row.decision === "reveal_cached" || row.decision === "reveal_live");
  const skipped = results.filter((row) => row.decision === "skip");
  const errors = results.filter((row) => row.decision === "error");
  const grouped = countBy(results, (row) => reasonGroup(row.reason));
  const reasonCounts = countBy(results, (row) => `${row.band}:${row.reason}`);
  const riskCounts = countBy(results, (row) => riskLevel(row, dryRun.sourceHealth));
  const fixRows = results.filter((row) => riskLevel(row, dryRun.sourceHealth) === "fix");
  const fixOrWatchRows = results.filter((row) => riskLevel(row, dryRun.sourceHealth) === "fix_or_watch");
  const watchRows = results.filter((row) => riskLevel(row, dryRun.sourceHealth) === "watch");
  const observableRows = results.filter((row) => riskLevel(row, dryRun.sourceHealth) === "observe");

  const bandRows = ([1, 2, 3] as PackBand[]).map((band) => {
    const rows = results.filter((row) => row.band === band);
    return {
      band,
      sampled: rows.length,
      reveal: rows.filter((row) => row.decision === "reveal_cached" || row.decision === "reveal_live").length,
      skipped: rows.filter((row) => row.decision === "skip").length,
      error: rows.filter((row) => row.decision === "error").length,
      openLikely: dryRun.bandSummaries.find((row) => row.band === band)?.openLikely ?? false,
      liveChecked: rows.filter((row) => row.liveChecked).length,
      stale: rows.filter((row) => row.stale).length,
      activeReadyPool: activeReadyByBand.get(band) ?? 0,
    };
  });

  const actionRows = [
    {
      action: "runtime_ok",
      count: revealed.length,
      note: "현재 드라이런 기준 열기 가능한 카드. 런타임 변경 불필요.",
    },
    {
      action: "sync_or_invalidate",
      count: fixRows.length,
      note: "판매완료/비정상 타입/메타 불일치 신호. 후보풀 정리 또는 lifecycle 동기화 후보.",
    },
    {
      action: "recheck_before_invalidate",
      count: fixOrWatchRows.length,
      note: "source healthy 상태의 fetch_failed 또는 기타 sold 신호. 1회 재확인 후 정리 후보.",
    },
    {
      action: "watch_fetch_or_sold_signal",
      count: watchRows.length,
      note: "source degraded/unhealthy 상태의 fetch_failed는 즉시 정리하지 않고 반복 관찰.",
    },
    {
      action: "increase_diagnostic_detail_limit_only_if_needed",
      count: observableRows.length,
      note: "not_checked_detail_limit은 진단 표본 제한. 운영 런타임 결함으로 보지 않음.",
    },
  ].filter((row) => row.count > 0);

  const riskyExamples = dedupeExamples([
    ...fixRows,
    ...fixOrWatchRows,
    ...watchRows,
    ...observableRows,
    ...skipped.filter((row) => row.reason !== "not_checked_detail_limit"),
    ...errors,
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    dryRunGeneratedAt: dryRun.generatedAt,
    sourceHealth: dryRun.sourceHealth,
    summary: {
      sampled: num(results.length),
      reveal: `${num(revealed.length)} (${pct(revealed.length, results.length)})`,
      skipped: `${num(skipped.length)} (${pct(skipped.length, results.length)})`,
      errors: `${num(errors.length)} (${pct(errors.length, results.length)})`,
      riskFixOrWatch: `${num(fixRows.length + fixOrWatchRows.length + watchRows.length)} (${pct(fixRows.length + fixOrWatchRows.length + watchRows.length, results.length)})`,
      activeReadyPool: num(pool.filter((row) => row.status === "ready").length),
      reservedPool: num(pool.filter((row) => row.status === "reserved").length),
    },
    bandRows,
    reasonGroups: grouped,
    reasons: reasonCounts,
    riskCounts,
    actionRows,
    examples: riskyExamples,
  };

  const jsonPath = path.join(reportsDir, "pack-open-quality-latest.json");
  const mdPath = path.join(reportsDir, "pack-open-quality-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown(report));

  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    dryRunGeneratedAt: report.dryRunGeneratedAt,
    sourceHealth: report.sourceHealth,
    summary: report.summary,
    bandRows: report.bandRows,
    reasonGroups: report.reasonGroups,
    actionRows: report.actionRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
