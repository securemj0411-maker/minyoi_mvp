import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnvFile(filePath) {
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

await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

function arg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function intArg(name, fallback, min, max) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

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

function seconds(ms) {
  return `${(n(ms) / 1000).toFixed(1)}s`;
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 필요");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 필요");
  return { apikey: key, authorization: `Bearer ${key}` };
}

async function fetchJson(pathname, fallback = []) {
  try {
    const res = await fetch(`${supabaseRestUrl()}${pathname}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(restTimeoutMs),
    });
    if (res.status === 404) return fallback;
    if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
    return res.json();
  } catch (err) {
    fetchIssues.push({
      path: pathname.slice(0, 260),
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function mapRows(map, limit = 12) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => [key, num(count)]);
}

function workerName(row) {
  const meta = row.request_meta ?? {};
  const mode = typeof meta.pipelineMode === "string" ? meta.pipelineMode : "";
  if (mode) return mode;
  const value = row.request_path ?? "";
  if (value.includes("/detail-worker")) return "detail_worker";
  if (value.includes("/deep-crawl")) return "deep_crawl";
  if (value.includes("/market-worker")) return "market_worker";
  if (value.includes("/pool-warmer")) return "pool_warmer";
  if (value.includes("/housekeeper")) return "housekeeper";
  if (value.includes("/lifecycle-worker") && (value.includes("terminal-recheck") || value.includes("terminal_recheck"))) {
    return "lifecycle_terminal_recheck";
  }
  if (value.includes("/lifecycle-worker")) return "lifecycle_worker";
  if (value.includes("/tick")) return "tick";
  return value || "unknown";
}

function stage(row, name) {
  return row.stage_stats?.stages?.[name] ?? {};
}

function stageDuration(row, name) {
  return n(row.stage_stats?.stageDurationsMs?.[name]);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const SEARCH_COUNTER_FIELDS = new Set([
  "unique_items",
  "detail_refresh_items",
  "observation_rows",
  "raw_full_upsert_rows",
  "title_triage_skip_rows",
  "raw_touch_active_seen_rows",
  "raw_touch_active_reset_rows",
  "raw_touch_active_rows",
  "raw_touch_terminal_rows",
  "raw_touch_active_seen_coalesce_eligible_rows",
  "raw_touch_active_seen_coalesce_would_skip_rows",
  "raw_touch_active_seen_coalesce_skipped_rows",
  "raw_touch_active_seen_coalesce_touch_now_rows",
  "raw_touch_active_seen_coalesce_protected_rows",
  "raw_touch_active_seen_coalesce_window_ms",
  "raw_touch_active_seen_coalesce_non_pool_window_ms",
  "raw_touch_active_seen_coalesce_pool_protected_rows",
  "raw_touch_active_seen_coalesce_non_pool_rows",
  "raw_touch_active_seen_coalesce_enabled",
  "load_existing_raw_requested_pids",
  "load_existing_raw_unique_pids",
  "load_existing_raw_chunks",
  "load_existing_raw_returned_rows",
  "seller_seen_rows",
  "seller_upsert_rows",
  "seller_upsert_skipped_rows",
  "seller_search_refresh_window_ms",
  "changed_items",
  "market_changed_items",
  "market_invalidations",
]);

function isSearchCounterField(name) {
  return SEARCH_COUNTER_FIELDS.has(name);
}

function percentile(values, p) {
  const filtered = values.map(n).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (filtered.length === 0) return 0;
  const idx = Math.min(filtered.length - 1, Math.max(0, Math.ceil((p / 100) * filtered.length) - 1));
  return filtered[idx];
}

function failureBucket(row) {
  const raw = String(row.error_message ?? "").trim();
  if (!raw) return "unknown";
  if (/57014|statement timeout|timed out/i.test(raw)) return "statement_timeout";
  if (/PGRST002|schema cache/i.test(raw)) return "postgrest_schema_cache";
  if (/504|upstream request timeout/i.test(raw)) return "upstream_timeout";
  if (/Supabase REST failed 5/i.test(raw)) return "supabase_5xx";
  if (/stale running/i.test(raw)) return "stale_running";
  return raw.slice(0, 90);
}

function dbUrl() {
  return process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_PRISMA_URL
    || process.env.SUPABASE_DB_URL
    || "";
}

function redactSecret(value) {
  return String(value)
    .replace(/postgresql:\/\/([^:]+):([^@]+)@/g, "postgresql://$1:<redacted>@")
    .replace(/PGPASSWORD=[^\s]+/g, "PGPASSWORD=<redacted>");
}

function psqlArgsFromUrl(rawUrl) {
  const url = new URL(rawUrl);
  return {
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get("sslmode") ?? process.env.PGSSLMODE ?? "require",
    },
    args: [
      "-h", url.hostname,
      "-p", url.port || "5432",
      "-U", decodeURIComponent(url.username),
      "-d", url.pathname.replace(/^\//, "") || "postgres",
    ],
  };
}

const PG_STAT_SQL = `
with stats as (
  select
    queryid::text as queryid,
    calls,
    total_exec_time,
    mean_exec_time,
    rows,
    shared_blks_hit,
    shared_blks_read,
    shared_blks_dirtied,
    shared_blks_written,
    temp_blks_read,
    temp_blks_written,
    wal_bytes,
    left(regexp_replace(query, '\\s+', ' ', 'g'), 520) as query
  from pg_stat_statements
  where dbid = (select oid from pg_database where datname = current_database())
    and query not ilike '%pg_stat_statements%'
),
ranked as (
  select
    *,
    (shared_blks_read + shared_blks_dirtied + shared_blks_written + temp_blks_read + temp_blks_written) as io_blocks,
    (shared_blks_read + shared_blks_written + temp_blks_read + temp_blks_written) as physical_blocks
  from stats
)
select json_build_object(
  'by_io', coalesce((select json_agg(t) from (
    select queryid, calls, round(total_exec_time::numeric, 2) as total_ms, round(mean_exec_time::numeric, 2) as mean_ms,
      rows, io_blocks, physical_blocks, wal_bytes, query
    from ranked order by io_blocks desc, total_exec_time desc limit 20
  ) t), '[]'::json),
  'by_total_time', coalesce((select json_agg(t) from (
    select queryid, calls, round(total_exec_time::numeric, 2) as total_ms, round(mean_exec_time::numeric, 2) as mean_ms,
      rows, io_blocks, physical_blocks, wal_bytes, query
    from ranked order by total_exec_time desc limit 20
  ) t), '[]'::json),
  'by_calls', coalesce((select json_agg(t) from (
    select queryid, calls, round(total_exec_time::numeric, 2) as total_ms, round(mean_exec_time::numeric, 2) as mean_ms,
      rows, io_blocks, physical_blocks, wal_bytes, query
    from ranked order by calls desc limit 20
  ) t), '[]'::json)
);
`;

async function resolvePsqlCommand() {
  const candidates = [
    process.env.PSQL_BIN,
    "psql",
    "/opt/homebrew/opt/libpq/bin/psql",
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "/usr/bin/psql",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 5000 });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function loadPgStatStatements() {
  const url = dbUrl();
  if (!url) {
    return {
      ok: false,
      reason: "DATABASE_URL/POSTGRES_URL/SUPABASE_DB_URL not configured",
      by_io: [],
      by_total_time: [],
      by_calls: [],
    };
  }
  const psql = await resolvePsqlCommand();
  if (!psql) {
    return {
      ok: false,
      reason: "psql command not found",
      by_io: [],
      by_total_time: [],
      by_calls: [],
    };
  }
  try {
    const connection = psqlArgsFromUrl(url);
    const { stdout } = await execFileAsync(
      psql,
      [...connection.args, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", PG_STAT_SQL],
      { timeout: 20_000, maxBuffer: 4 * 1024 * 1024, env: connection.env },
    );
    const parsed = JSON.parse(stdout.trim());
    return { ok: true, reason: null, ...parsed };
  } catch (err) {
    return {
      ok: false,
      reason: redactSecret(err instanceof Error ? err.message : String(err)),
      by_io: [],
      by_total_time: [],
      by_calls: [],
    };
  }
}

function queryRows(rows) {
  return rows.slice(0, 10).map((row) => [
    row.calls,
    row.total_ms,
    row.mean_ms,
    row.io_blocks,
    row.wal_bytes,
    `\`${String(row.query ?? "").replace(/`/g, "'")}\``,
  ]);
}

const windowHours = intArg("window-hours", 24, 1, 720);
const runLimit = intArg("run-limit", 120, 30, 1000);
const queueLimit = intArg("queue-limit", 300, 50, 2000);
const restTimeoutMs = intArg("rest-timeout-ms", 20_000, 3_000, 60_000);
const fetchIssues = [];
const now = new Date();
const cutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
const cutoffIso = cutoff.toISOString();
const reportDir = path.join(appDir, "reports");
const outPath = arg("out", path.join(reportDir, `db-hotpaths-${dateStamp(now)}.md`));
const summaryPath = outPath.replace(/\.md$/i, ".json");
const latestMd = path.join(reportDir, "db-hotpaths-latest.md");
const latestJson = path.join(reportDir, "db-hotpaths-latest.json");

const [runs, sourceHealthRows, detailQueueRows, marketQueueRows, pgStats] = await Promise.all([
  fetchJson(
    `/mvp_collect_runs?select=id,status,request_path,request_meta,duration_ms,collected_count,title_normal_count,enriched_count,scored_count,upserted_count,ai_api_calls,ai_cache_hits,stage_stats,error_message,started_at&started_at=gte.${encodeURIComponent(cutoffIso)}&order=started_at.desc&limit=${runLimit}`,
  ),
  fetchJson(
    `/mvp_source_health?select=status,previous_status,checked_at,reason,baseline_json,hysteresis_json&source=eq.bunjang&checked_at=gte.${encodeURIComponent(cutoffIso)}&order=checked_at.desc&limit=24`,
    [],
  ),
  fetchJson(
    `/mvp_detail_queue?select=status,attempts,updated_at&order=updated_at.desc&limit=${queueLimit}`,
    [],
  ),
  fetchJson(
    `/mvp_market_key_invalidation?select=status,event_count,priority,last_event_at&order=last_event_at.desc&limit=${queueLimit}`,
    [],
  ),
  loadPgStatStatements(),
]);

const workerStats = new Map();
const stageStats = new Map();
const searchTimingStats = new Map();
const searchCounterStats = new Map();
const failureReasons = new Map();
const durations = [];

for (const row of runs) {
  const worker = workerName(row);
  const item = workerStats.get(worker) ?? {
    worker,
    runs: 0,
    failed: 0,
    durationMs: 0,
    collected: 0,
    titleNormal: 0,
    enriched: 0,
    scored: 0,
    upserted: 0,
    aiCalls: 0,
  };
  item.runs += 1;
  if (row.status === "failed") item.failed += 1;
  item.durationMs += n(row.duration_ms);
  item.collected += n(row.collected_count);
  item.titleNormal += n(row.title_normal_count);
  item.enriched += n(row.enriched_count);
  item.scored += n(row.scored_count);
  item.upserted += n(row.upserted_count);
  item.aiCalls += n(row.ai_api_calls);
  workerStats.set(worker, item);
  if (row.duration_ms != null) durations.push(n(row.duration_ms));
  if (row.status === "failed") inc(failureReasons, failureBucket(row));

  for (const name of ["search", "deep", "detail", "score", "source_health", "market_stats", "pool_warmer", "lifecycle", "housekeeper"]) {
    const durationMs = stageDuration(row, name);
    const stats = stage(row, name);
    if (!durationMs && Object.keys(stats).length === 0) continue;
    const current = stageStats.get(name) ?? {
      stage: name,
      calls: 0,
      durationMs: 0,
      collected: 0,
      queued: 0,
      claimed: 0,
      enriched: 0,
      scored: 0,
      upserted: 0,
      poolUpserted: 0,
      detailFailed: 0,
    };
    current.calls += 1;
    current.durationMs += durationMs;
    current.collected += n(stats.collected);
    current.queued += n(stats.queued);
    current.claimed += n(stats.claimed);
    current.enriched += n(stats.enriched);
    current.scored += n(stats.scored);
    current.upserted += n(stats.upserted);
    current.poolUpserted += n(stats.poolUpserted);
    current.detailFailed += n(stats.detailFailed);
    stageStats.set(name, current);

    if (name === "search") {
      const timings = record(stats.timingsMs);
      for (const [timingName, timingValue] of Object.entries(timings)) {
        if (isSearchCounterField(timingName)) {
          const counter = searchCounterStats.get(timingName) ?? {
            name: timingName,
            calls: 0,
            total: 0,
            max: 0,
          };
          const value = n(timingValue);
          counter.calls += 1;
          counter.total += value;
          counter.max = Math.max(counter.max, value);
          searchCounterStats.set(timingName, counter);
          continue;
        }
        const timing = searchTimingStats.get(timingName) ?? {
          name: timingName,
          calls: 0,
          totalMs: 0,
          maxMs: 0,
        };
        const value = n(timingValue);
        timing.calls += 1;
        timing.totalMs += value;
        timing.maxMs = Math.max(timing.maxMs, value);
        searchTimingStats.set(timingName, timing);
      }
    }
  }
}

const queueStatus = new Map();
for (const row of detailQueueRows) inc(queueStatus, row.status ?? "unknown");
const marketQueueStatus = new Map();
let marketEvents = 0;
for (const row of marketQueueRows) {
  inc(marketQueueStatus, row.status ?? "unknown");
  marketEvents += n(row.event_count);
}

const workerRows = [...workerStats.values()].sort((a, b) => b.durationMs - a.durationMs);
const stageRows = [...stageStats.values()].sort((a, b) => b.durationMs - a.durationMs);
const searchTimingRows = [...searchTimingStats.values()].sort((a, b) => b.totalMs - a.totalMs);
const searchCounterRows = [...searchCounterStats.values()].sort((a, b) => b.total - a.total);
const latestHealth = sourceHealthRows[0] ?? null;
const unhealthyHealthCount = sourceHealthRows.filter((row) => row.status === "unhealthy").length;
const sourceHealthState = latestHealth
  ? `${latestHealth.status} · ${latestHealth.reason ?? "-"}`
  : "없음";
const failedRuns = runs.filter((row) => row.status === "failed");

const suspects = [];
if (!pgStats.ok) suspects.push(`pg_stat_statements 미실행: ${pgStats.reason}`);
for (const issue of fetchIssues) suspects.push(`REST fetch 실패/timeout: ${issue.error}`);
if (failedRuns.length / Math.max(1, runs.length) > 0.2) suspects.push(`최근 run 실패율 ${pct(failedRuns.length, runs.length)}로 높음`);
if (latestHealth?.status === "unhealthy") {
  suspects.push(`latest source health가 unhealthy (${latestHealth.reason ?? "-"})`);
} else if (unhealthyHealthCount > 0) {
  suspects.push(`window 내 source health가 회복됨: latest ${sourceHealthState}, 이전 unhealthy snapshot ${unhealthyHealthCount}개`);
}
const topWorker = workerRows[0];
if (topWorker) suspects.push(`누적 함수시간 1위 worker: ${topWorker.worker} (${seconds(topWorker.durationMs)})`);
const topStage = stageRows[0];
if (topStage) suspects.push(`누적 stage 시간 1위: ${topStage.stage} (${seconds(topStage.durationMs)})`);
if ((queueStatus.get("pending") ?? 0) > 500) suspects.push(`detail queue pending ${num(queueStatus.get("pending"))}건`);
if ((marketQueueStatus.get("pending") ?? 0) > 100) suspects.push(`market invalidation pending ${num(marketQueueStatus.get("pending"))}건`);

const summary = {
  generatedAt: now.toISOString(),
  windowHours,
  cutoff: cutoffIso,
  runLimit,
  queueLimit,
  runs: {
    total: runs.length,
    failed: failedRuns.length,
    failureRate: runs.length ? failedRuns.length / runs.length : 0,
    p50DurationMs: percentile(durations, 50),
    p95DurationMs: percentile(durations, 95),
    failureReasons: Object.fromEntries(failureReasons),
  },
  latestSourceHealth: latestHealth,
  sourceHealthWindow: {
    total: sourceHealthRows.length,
    unhealthy: unhealthyHealthCount,
    latest: latestHealth,
  },
  queue: {
    detail: Object.fromEntries(queueStatus),
    market: Object.fromEntries(marketQueueStatus),
    marketEvents,
  },
  workers: workerRows,
  stages: stageRows,
  searchTimings: searchTimingRows,
  searchCounters: searchCounterRows,
  pgStatStatements: pgStats,
  fetchIssues,
  suspects,
};

const pgSection = pgStats.ok
  ? `## pg_stat_statements

### Physical/Dirty IO Top

${table(["calls", "total ms", "mean ms", "io blocks", "wal bytes", "query"], queryRows(pgStats.by_io))}

### Total Time Top

${table(["calls", "total ms", "mean ms", "io blocks", "wal bytes", "query"], queryRows(pgStats.by_total_time))}

### Calls Top

${table(["calls", "total ms", "mean ms", "io blocks", "wal bytes", "query"], queryRows(pgStats.by_calls))}
`
  : `## pg_stat_statements

- 상태: 실행 안 됨
- 이유: ${pgStats.reason}

직접 SQL Editor에서 볼 때는 아래 관점으로 확인합니다.

\`\`\`sql
${PG_STAT_SQL.trim()}
\`\`\`
`;

const md = `# DB Hot Path Report

- generated_at: ${now.toISOString()}
- window: 최근 ${windowHours}시간
- run_limit: ${runLimit}
- queue_limit: ${queueLimit}
- source: Supabase REST 운영 로그${pgStats.ok ? " + pg_stat_statements" : " (pg_stat_statements는 연결값 필요)"}

## 결론

${suspects.length === 0 ? "- 즉시 보이는 hot path 경고는 없습니다." : suspects.map((item) => `- ${item}`).join("\n")}

## 운영 로그 기반 프록시

${table(
  ["항목", "값"],
  [
    ["run", `${num(runs.length)}개`],
    ["실패", `${num(failedRuns.length)}개 (${pct(failedRuns.length, runs.length)})`],
    ["duration p50 / p95", `${seconds(percentile(durations, 50))} / ${seconds(percentile(durations, 95))}`],
    ["latest source health", sourceHealthState],
    ["source health window", `${num(sourceHealthRows.length)}개 · unhealthy ${num(unhealthyHealthCount)}개`],
    ["detail queue", mapRows(queueStatus, 8).map((row) => `${row[0]} ${row[1]}`).join(", ") || "없음"],
    ["market invalidation", `${mapRows(marketQueueStatus, 8).map((row) => `${row[0]} ${row[1]}`).join(", ") || "없음"} · events ${num(marketEvents)}`],
  ],
)}

${fetchIssues.length > 0
  ? `### 데이터 로딩 경고\n\n${table(["path", "error"], fetchIssues.map((issue) => [issue.path, issue.error]))}\n`
  : ""}

### 실패 원인

${failedRuns.length === 0 ? "- 실패 없음" : table(["reason", "count"], mapRows(failureReasons, 12))}

### Worker별 누적 비용 프록시

${table(
  ["worker", "runs", "fail", "duration", "collected", "enriched", "scored", "upserted", "AI"],
  workerRows.map((row) => [
    row.worker,
    num(row.runs),
    `${num(row.failed)} (${pct(row.failed, row.runs)})`,
    seconds(row.durationMs),
    num(row.collected),
    num(row.enriched),
    num(row.scored),
    num(row.upserted),
    num(row.aiCalls),
  ]),
)}

### Stage별 누적 비용 프록시

${table(
  ["stage", "calls", "duration", "collected", "queued", "claimed", "enriched", "scored", "pool", "detail fail"],
  stageRows.map((row) => [
    row.stage,
    num(row.calls),
    seconds(row.durationMs),
    num(row.collected),
    num(row.queued),
    num(row.claimed),
    num(row.enriched),
    num(row.scored),
    num(row.poolUpserted),
    num(row.detailFailed),
  ]),
)}

### Search 내부 timing breakdown

${searchTimingRows.length === 0
  ? "- 아직 `stage_stats.stages.search.timingsMs`가 포함된 tick run이 없습니다. 다음 tick 이후 다시 실행하세요."
  : table(
    ["name", "samples", "total", "avg", "max"],
    searchTimingRows.map((row) => [
      row.name,
      num(row.calls),
      seconds(row.totalMs),
      seconds(row.totalMs / Math.max(1, row.calls)),
      seconds(row.maxMs),
    ]),
  )}

### Search 내부 count breakdown

${searchCounterRows.length === 0
  ? "- 아직 search counter가 없습니다."
  : table(
    ["name", "samples", "total", "avg", "max"],
    searchCounterRows.map((row) => [
      row.name,
      num(row.calls),
      num(row.total),
      num(row.total / Math.max(1, row.calls)),
      num(row.max),
    ]),
  )}

${pgSection}

## 해석 원칙

1. 운영 로그 프록시는 "어떤 worker/stage가 많이 일했는지"를 보여주지만, 실제 disk block read/write는 pg_stat_statements가 더 정확합니다.
2. pg_stat top query를 보기 전에는 broad index를 추가하지 않습니다.
3. hot table write path에 index를 추가할 때는 write amplification을 같이 봅니다.
4. source health가 unhealthy인 구간의 측정값은 burst 소진 영향이 섞일 수 있으므로, Pro/Small 안정화 후 한 번 더 비교합니다.

## 다음 액션

${pgStats.ok
  ? "1. pg_stat 누적값에는 과거 pre-optimization query도 섞이므로, 운영 로그 window의 stage/timing 변화와 함께 봅니다.\n2. 다음 작업단위는 pg_stat의 누적 Top만 보지 말고 최근 timing breakdown에서 반복되는 write/read를 하나만 고릅니다.\n3. broad index 추가는 보류하고, 쿼리/쓰기량 축소가 먼저인지 확인합니다."
  : "1. DB SQL URL을 `DATABASE_URL` 또는 `SUPABASE_DB_URL`로 넣고 `psql`이 있는 환경에서 다시 실행합니다.\n2. `pg_stat_statements.by_io`와 `by_total_time`이 같은 쿼리를 가리키는지 봅니다.\n3. 그 결과로 인덱스/쿼리/retention 중 하나만 다음 작업단위로 선택합니다."}
`;

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, md, "utf-8");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
await writeFile(latestMd, md, "utf-8");
await writeFile(latestJson, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

console.log(`report saved  -> ${outPath}`);
console.log(`summary saved -> ${summaryPath}`);
console.log(`latest saved  -> ${latestMd}`);
console.log(`runs=${runs.length} failed=${failedRuns.length} pg_stat=${pgStats.ok ? "ok" : "missing"}`);
if (suspects.length > 0) console.log(`top suspect: ${suspects[0]}`);
