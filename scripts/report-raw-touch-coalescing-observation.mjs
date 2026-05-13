import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportDir = path.join(appDir, "reports");

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(part, total, digits = 1) {
  if (!total) return "0%";
  return `${((n(part) / n(total)) * 100).toFixed(digits)}%`;
}

function num(value) {
  return Math.round(n(value)).toLocaleString("ko-KR");
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function arg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function readJson(name, required = true) {
  const filePath = path.join(reportDir, name);
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch (error) {
    if (!required) return null;
    throw new Error(`${name} 읽기 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function searchCounter(dbHotpaths, name) {
  return dbHotpaths.searchCounters?.find((row) => row.name === name) ?? { calls: 0, total: 0, max: 0 };
}

function parseDate(value) {
  const date = new Date(value ?? "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursOld(value, nowDate = now) {
  const date = parseDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowDate.getTime() - date.getTime()) / 3_600_000);
}

function sourceReportInfo(name, generatedAt, maxAgeHours) {
  const ageHours = hoursOld(generatedAt);
  return {
    name,
    generatedAt: generatedAt ?? null,
    ageHours,
    stale: ageHours > maxAgeHours,
  };
}

function decisionStatus({ tick, pack, lifecycle, terminal, db }) {
  const maxSourceAgeHours = n(arg("max-source-age-hours", "2"));
  const sourceReports = [
    sourceReportInfo("tick", tick.generatedAt, maxSourceAgeHours),
    sourceReportInfo("pack", pack.generatedAt, maxSourceAgeHours),
    sourceReportInfo("lifecycle", lifecycle.generated_at, maxSourceAgeHours),
    sourceReportInfo("terminal", terminal.generated_at, maxSourceAgeHours),
    sourceReportInfo("db", db.generatedAt, maxSourceAgeHours),
  ];
  const staleReports = sourceReports.filter((report) => report.stale);
  const dryRunCalls = searchCounter(db, "raw_touch_active_seen_coalesce_eligible_rows").calls;
  const enabledSamples = searchCounter(db, "raw_touch_active_seen_coalesce_enabled").total;
  const failureRate = n(db.runs?.failureRate);
  const tickWorker = db.workers?.find((row) => row.worker === "tick") ?? {};
  const tickFailures = n(tickWorker.failed);
  const reveal = n(String(pack.summary?.reveal ?? "0").match(/\d+/)?.[0]);
  const sampled = n(pack.summary?.sampled);
  const activePoolOverlap = n(terminal.summary?.active_pool_rows) + n(terminal.summary?.ready_pool_rows) + n(terminal.summary?.reserved_pool_rows);
  const recheck = n(lifecycle.summary?.recheck_required);

  if (staleReports.length > 0) return "hold_stale_inputs";
  if (dryRunCalls < 10) return "observe_more";
  if (db.latestSourceHealth?.status !== "healthy" || failureRate > 0.05 || tickFailures > 0) return "hold_health";
  if (sampled > 0 && reveal < sampled) return "hold_pack_open";
  if (activePoolOverlap > 0) return "hold_terminal_overlap";
  if (recheck > 0) return "hold_lifecycle_recheck";
  if (n(tick.totals?.coalesceWouldSkip) <= 0) return "no_roi";
  if (enabledSamples > 0) return "active_observation";
  return "candidate_for_review";
}

const now = new Date();
const outPath = arg("out", path.join(reportDir, `raw-touch-coalescing-observation-${dateStamp(now)}.md`));
const outJson = outPath.replace(/\.md$/i, ".json");
const latestMd = path.join(reportDir, "raw-touch-coalescing-observation-latest.md");
const latestJson = path.join(reportDir, "raw-touch-coalescing-observation-latest.json");

const tick = await readJson("tick-write-amplification-latest.json");
const pack = await readJson("pack-open-quality-latest.json");
const lifecycle = await readJson("lifecycle-mismatch-latest.json");
const terminal = await readJson("terminal-interval-candidates-latest.json");
const db = await readJson("db-hotpaths-latest.json");

const coalesce = {
  calls: searchCounter(db, "raw_touch_active_seen_coalesce_eligible_rows").calls,
  enabledCalls: searchCounter(db, "raw_touch_active_seen_coalesce_enabled").total,
  windowMs: searchCounter(db, "raw_touch_active_seen_coalesce_window_ms").max,
  eligible: n(tick.totals?.coalesceEligible),
  wouldSkip: n(tick.totals?.coalesceWouldSkip),
  actualSkipped: searchCounter(db, "raw_touch_active_seen_coalesce_skipped_rows").total,
  touchNow: n(tick.totals?.coalesceTouchNow),
  protected: n(tick.totals?.coalesceProtected),
  rawTouch: n(tick.totals?.rawTouch),
  rawFull: n(tick.totals?.rawFull),
  changed: n(tick.totals?.changed),
};

const packSummary = {
  sourceHealth: pack.sourceHealth,
  sampled: n(pack.summary?.sampled),
  reveal: n(String(pack.summary?.reveal ?? "0").match(/\d+/)?.[0]),
  skipped: n(String(pack.summary?.skipped ?? "0").match(/\d+/)?.[0]),
  errors: n(String(pack.summary?.errors ?? "0").match(/\d+/)?.[0]),
  activeReadyPool: n(pack.summary?.activeReadyPool),
  reservedPool: n(pack.summary?.reservedPool),
};

const lifecycleSummary = {
  mismatchTotal: n(lifecycle.summary?.total),
  recheckRequired: n(lifecycle.summary?.recheck_required),
  autoSyncCandidates: n(lifecycle.summary?.auto_sync_candidates),
  manualReview: n(lifecycle.summary?.manual_review),
};

const terminalSummary = {
  total: n(terminal.summary?.total),
  readyCategoryRows: n(terminal.summary?.ready_category_rows),
  activePoolRows: n(terminal.summary?.active_pool_rows),
  readyPoolRows: n(terminal.summary?.ready_pool_rows),
  reservedPoolRows: n(terminal.summary?.reserved_pool_rows),
  invalidatedPoolRows: n(terminal.summary?.invalidated_pool_rows),
};

const dbSummary = {
  health: db.latestSourceHealth?.status ?? "unknown",
  runTotal: n(db.runs?.total),
  failed: n(db.runs?.failed),
  failureRate: n(db.runs?.failureRate),
  p50DurationMs: n(db.runs?.p50DurationMs),
  p95DurationMs: n(db.runs?.p95DurationMs),
};

const status = decisionStatus({ tick, pack, lifecycle, terminal, db });
const maxSourceAgeHours = n(arg("max-source-age-hours", "2"));
const sourceReportRows = [
  sourceReportInfo("tick", tick.generatedAt, maxSourceAgeHours),
  sourceReportInfo("pack", pack.generatedAt, maxSourceAgeHours),
  sourceReportInfo("lifecycle", lifecycle.generated_at, maxSourceAgeHours),
  sourceReportInfo("terminal", terminal.generated_at, maxSourceAgeHours),
  sourceReportInfo("db", db.generatedAt, maxSourceAgeHours),
];
const staleReports = sourceReportRows.filter((report) => report.stale);
const notes = [];
if (status === "hold_stale_inputs") {
  notes.push(`입력 리포트가 오래됐습니다. stale reports: ${staleReports.map((report) => `${report.name} ${report.ageHours.toFixed(1)}h`).join(", ")}. lifecycle/terminal/db/tick/pack 리포트를 같은 window로 재생성한 뒤 다시 판단합니다.`);
}
if (status === "observe_more") notes.push("dry-run counter 호출 수가 아직 적습니다. 실제 write skip 판단은 최소 24시간 window 이후로 보류합니다.");
if (status === "hold_health") notes.push("source health, tick 실패, 또는 전체 실패율이 불안정합니다. write 절감 기능을 켜기 전에 안정화가 먼저입니다.");
if (status === "hold_pack_open") notes.push("pack open/reveal 경로에 문제가 있습니다. 사용자 가시 경로가 정상화되기 전까지 write skip은 보류합니다.");
if (status === "hold_terminal_overlap") notes.push("terminal interval 후보가 active/ready/reserved pool과 겹칩니다. sold/live 경로 정리 전까지 write skip은 보류합니다.");
if (status === "hold_lifecycle_recheck") notes.push("lifecycle recheck 대기열이 남아 있습니다. 이 상태에서는 last_seen 의미 변경을 보수적으로 다룹니다.");
if (status === "no_roi") notes.push("would_skip 값이 의미 있게 나오지 않았습니다. 기능을 켤 이유가 없습니다.");
if (status === "active_observation") notes.push("coalescing이 실제 런타임에 켜졌습니다. tick 2~3회 동안 actual skipped rows, source health, pack open을 관찰합니다.");
if (status === "candidate_for_review") notes.push("기술적으로 검토 후보지만, 실제 write skip은 별도 승인 후에만 진행합니다.");

const summary = {
  generatedAt: now.toISOString(),
  status,
  coalesce,
  pack: packSummary,
  lifecycle: lifecycleSummary,
  terminal: terminalSummary,
  db: dbSummary,
  notes,
  sourceReports: {
    tick: sourceReportRows.find((report) => report.name === "tick"),
    pack: sourceReportRows.find((report) => report.name === "pack"),
    lifecycle: sourceReportRows.find((report) => report.name === "lifecycle"),
    terminal: sourceReportRows.find((report) => report.name === "terminal"),
    db: sourceReportRows.find((report) => report.name === "db"),
  },
};

const md = `# Raw Touch Coalescing Observation

- generated_at: ${summary.generatedAt}
- decision_status: **${status}**
- source_health: **${dbSummary.health}**
- coalescing_enabled_samples: **${num(coalesce.enabledCalls)}**

## 판단

${notes.map((note) => `- ${note}`).join("\n")}

## Coalescing Counter

${table(
  ["항목", "값"],
  [
    ["counter calls", num(coalesce.calls)],
    ["enabled samples", num(coalesce.enabledCalls)],
    ["window", `${num(coalesce.windowMs)}ms`],
    ["eligible", num(coalesce.eligible)],
    ["would skip", `${num(coalesce.wouldSkip)} (${pct(coalesce.wouldSkip, coalesce.eligible)})`],
    ["actual skipped rows", num(coalesce.actualSkipped)],
    ["touch now", num(coalesce.touchNow)],
    ["protected", num(coalesce.protected)],
    ["raw touch total", num(coalesce.rawTouch)],
    ["raw full upsert", num(coalesce.rawFull)],
    ["changed items", `${num(coalesce.changed)} (${pct(coalesce.changed, coalesce.rawFull + coalesce.rawTouch)})`],
  ],
)}

## Guard Rails

${table(
  ["영역", "상태", "핵심 수치"],
  [
    ["source health", dbSummary.health, `runs ${num(dbSummary.runTotal)}, failed ${num(dbSummary.failed)}, p95 ${(dbSummary.p95DurationMs / 1000).toFixed(1)}s`],
    ["pack open", packSummary.reveal === packSummary.sampled ? "ok" : "hold", `reveal ${num(packSummary.reveal)}/${num(packSummary.sampled)}, activeReadyPool ${num(packSummary.activeReadyPool)}`],
    ["lifecycle mismatch", lifecycleSummary.recheckRequired > 0 ? "hold" : "ok", `recheck ${num(lifecycleSummary.recheckRequired)} / total ${num(lifecycleSummary.mismatchTotal)}`],
    ["terminal interval overlap", terminalSummary.activePoolRows + terminalSummary.readyPoolRows + terminalSummary.reservedPoolRows > 0 ? "hold" : "ok", `active ${num(terminalSummary.activePoolRows)}, ready ${num(terminalSummary.readyPoolRows)}, reserved ${num(terminalSummary.reservedPoolRows)}`],
  ],
)}

## Source Reports

${table(
  ["report", "generated_at", "age", "freshness"],
  Object.entries(summary.sourceReports).map(([name, report]) => [
    name,
    report?.generatedAt ?? "-",
    Number.isFinite(report?.ageHours) ? `${report.ageHours.toFixed(1)}h` : "unknown",
    report?.stale ? "stale" : "fresh",
  ]),
)}
`;

await mkdir(reportDir, { recursive: true });
await writeFile(outPath, md, "utf-8");
await writeFile(outJson, JSON.stringify(summary, null, 2), "utf-8");
await writeFile(latestMd, md, "utf-8");
await writeFile(latestJson, JSON.stringify(summary, null, 2), "utf-8");

console.log(`wrote ${outPath}`);
console.log(`wrote ${outJson}`);
console.log(`status=${status}`);
