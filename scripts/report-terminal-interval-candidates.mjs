import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

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

function dbUrl() {
  return process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_PRISMA_URL
    || process.env.SUPABASE_DB_URL
    || "";
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

async function findPsql() {
  const candidates = [
    process.env.PSQL_BIN,
    "psql",
    "/opt/homebrew/opt/libpq/bin/psql",
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "/Applications/Postgres.app/Contents/Versions/latest/bin/psql",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "psql") continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return "psql";
}

async function runSql(sql) {
  const rawUrl = dbUrl();
  if (!rawUrl) {
    throw new Error("DATABASE_URL/POSTGRES_URL/POSTGRES_PRISMA_URL/SUPABASE_DB_URL is required.");
  }
  const { env, args } = psqlArgsFromUrl(rawUrl);
  const psql = await findPsql();
  const { stdout } = await execFileAsync(psql, [...args, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    cwd: appDir,
    env,
    maxBuffer: 1024 * 1024 * 20,
  });
  return JSON.parse(stdout.trim());
}

function num(value) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function compactName(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 64 ? `${text.slice(0, 64)}...` : text;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

const sampleLimit = intArg("sampleLimit", 80, 20, 300);

const SQL = `
with base as (
  select
    r.pid,
    r.name,
    r.price,
    r.sale_status,
    r.first_seen_at,
    r.last_seen_at,
    r.last_changed_at,
    r.sold_detected_at,
    r.disappeared_at,
    r.detail_enriched_at,
    p.category,
    p.comparable_key,
    coalesce(cr.status, 'missing_readiness') as readiness_status,
    cp.status as pool_status,
    cp.profit_band,
    cp.invalidated_reason
  from public.mvp_raw_listings r
  left join public.mvp_listing_parsed p on p.pid = r.pid
  left join public.mvp_category_readiness cr on cr.category = p.category
  left join public.mvp_candidate_pool cp on cp.pid = r.pid
  where r.listing_state = 'active'
    and r.sold_detected_at is not null
),
obs_after_sold as (
  select
    b.pid,
    count(o.id)::int as events_after_sold,
    count(o.id) filter (where o.event_type = 'search_seen')::int as search_seen_after_sold,
    count(o.id) filter (where o.event_type = 'daily_snapshot')::int as daily_snapshot_after_sold,
    count(o.id) filter (where o.event_type = 'state_changed')::int as state_changed_after_sold,
    max(o.observed_at) as latest_observed_after_sold
  from base b
  left join public.mvp_listing_observations o
    on o.pid = b.pid
   and o.observed_at > b.sold_detected_at
  group by b.pid
),
classified as (
  select
    b.*,
    coalesce(o.events_after_sold, 0) as events_after_sold,
    coalesce(o.search_seen_after_sold, 0) as search_seen_after_sold,
    coalesce(o.daily_snapshot_after_sold, 0) as daily_snapshot_after_sold,
    coalesce(o.state_changed_after_sold, 0) as state_changed_after_sold,
    o.latest_observed_after_sold,
    case
      when b.sold_detected_at < b.first_seen_at or b.last_seen_at < b.first_seen_at then 'clock_order_issue'
      when coalesce(o.search_seen_after_sold, 0) > 0 and b.last_seen_at > b.sold_detected_at + interval '10 minutes' then 'sold_signal_then_search_reappeared'
      when b.last_seen_at > b.sold_detected_at + interval '10 minutes' then 'sold_signal_then_active_seen'
      when b.sold_detected_at >= now() - interval '2 hours' then 'recent_sold_signal_active'
      else 'stale_sold_signal_active'
    end as bucket,
    case
      when b.sold_detected_at < b.first_seen_at or b.last_seen_at < b.first_seen_at then 'hold_clock_fix'
      when coalesce(o.search_seen_after_sold, 0) > 0 or b.last_seen_at > b.sold_detected_at + interval '10 minutes' then 'terminal_interval_candidate'
      else 'detail_recheck_required'
    end as recommended_action
  from base b
  left join obs_after_sold o on o.pid = b.pid
),
summary as (
  select
    count(*)::int as total,
    count(*) filter (where recommended_action = 'terminal_interval_candidate')::int as terminal_interval_candidate,
    count(*) filter (where recommended_action = 'detail_recheck_required')::int as detail_recheck_required,
    count(*) filter (where recommended_action = 'hold_clock_fix')::int as hold_clock_fix,
    count(*) filter (where readiness_status = 'ready')::int as ready_category_rows,
    count(*) filter (where readiness_status = 'internal_only')::int as internal_only_rows,
    count(*) filter (where readiness_status not in ('ready','internal_only'))::int as other_readiness_rows,
    count(*) filter (where pool_status in ('ready','reserved'))::int as active_pool_rows,
    count(*) filter (where pool_status = 'ready')::int as ready_pool_rows,
    count(*) filter (where pool_status = 'reserved')::int as reserved_pool_rows,
    count(*) filter (where pool_status = 'invalidated')::int as invalidated_pool_rows
  from classified
),
by_bucket as (
  select
    bucket,
    recommended_action,
    count(*)::int as rows,
    count(*) filter (where readiness_status = 'ready')::int as ready_rows,
    count(*) filter (where readiness_status = 'internal_only')::int as internal_rows,
    count(*) filter (where pool_status in ('ready','reserved'))::int as active_pool_rows,
    count(*) filter (where search_seen_after_sold > 0)::int as search_reappeared_rows,
    max(last_seen_at) as latest_last_seen_at
  from classified
  group by bucket, recommended_action
),
by_category as (
  select
    coalesce(category, 'unknown') as category,
    readiness_status,
    count(*)::int as rows,
    count(*) filter (where recommended_action = 'terminal_interval_candidate')::int as terminal_interval_candidate,
    count(*) filter (where recommended_action = 'detail_recheck_required')::int as detail_recheck_required,
    count(*) filter (where recommended_action = 'hold_clock_fix')::int as hold_clock_fix,
    count(*) filter (where pool_status in ('ready','reserved'))::int as active_pool_rows
  from classified
  group by coalesce(category, 'unknown'), readiness_status
),
examples as (
  select *
  from classified
  order by
    case recommended_action
      when 'hold_clock_fix' then 1
      when 'terminal_interval_candidate' then 2
      else 3
    end,
    last_seen_at desc nulls last
  limit ${sampleLimit}
)
select json_build_object(
  'generated_at', now(),
  'parameters', json_build_object('sample_limit', ${sampleLimit}),
  'summary', (select row_to_json(summary) from summary),
  'by_bucket', coalesce((select json_agg(row_to_json(t)) from (
    select * from by_bucket order by rows desc, bucket
  ) t), '[]'::json),
  'by_category', coalesce((select json_agg(row_to_json(t)) from (
    select * from by_category order by rows desc, category
  ) t), '[]'::json),
  'examples', coalesce((select json_agg(row_to_json(t)) from examples t), '[]'::json)
) as report;
`;

function renderMarkdown(report) {
  const summary = report.summary ?? {};
  const generatedAt = report.generated_at ?? new Date().toISOString();

  const bucketRows = (report.by_bucket ?? []).map((row) => [
    row.bucket,
    row.recommended_action,
    num(row.rows),
    num(row.ready_rows),
    num(row.internal_rows),
    num(row.active_pool_rows),
    num(row.search_reappeared_rows),
    row.latest_last_seen_at ?? "-",
  ]);

  const categoryRows = (report.by_category ?? []).map((row) => [
    row.category,
    row.readiness_status,
    num(row.rows),
    num(row.terminal_interval_candidate),
    num(row.detail_recheck_required),
    num(row.hold_clock_fix),
    num(row.active_pool_rows),
  ]);

  const exampleRows = (report.examples ?? []).map((row) => [
    row.recommended_action,
    row.bucket,
    row.pid,
    compactName(row.name),
    row.category ?? "-",
    row.readiness_status ?? "-",
    row.pool_status ?? "-",
    row.profit_band ?? "-",
    row.sold_detected_at ?? "-",
    row.last_seen_at ?? "-",
    num(row.search_seen_after_sold),
  ]);

  return [
    "# Terminal Interval 후보 진단",
    "",
    `생성: ${generatedAt}`,
    "",
    "## 목적",
    "",
    "- `active` 상태인데 `sold_detected_at`이 남은 row를 단순 삭제하지 않고 유형화한다.",
    "- 판매완료/사라짐 이후 검색 재등장한 매물은 판매속도 계산과 현재 상태를 분리해야 하므로 terminal interval 후보로 본다.",
    "- 이 리포트는 read-only이며 DB schema나 row를 변경하지 않는다.",
    "",
    "## 요약",
    "",
    table(["항목", "값"], [
      ["active + sold_detected_at", num(summary.total)],
      ["terminal interval candidate", num(summary.terminal_interval_candidate)],
      ["detail recheck required", num(summary.detail_recheck_required)],
      ["hold clock fix", num(summary.hold_clock_fix)],
      ["ready category rows", num(summary.ready_category_rows)],
      ["internal_only rows", num(summary.internal_only_rows)],
      ["other readiness rows", num(summary.other_readiness_rows)],
      ["candidate pool ready/reserved", num(summary.active_pool_rows)],
      ["candidate pool ready", num(summary.ready_pool_rows)],
      ["candidate pool reserved", num(summary.reserved_pool_rows)],
      ["candidate pool invalidated", num(summary.invalidated_pool_rows)],
    ]),
    "",
    "## 유형별",
    "",
    table(["bucket", "recommended_action", "rows", "ready", "internal", "pool live", "search reappeared", "latest last_seen"], bucketRows),
    "",
    "## 카테고리별",
    "",
    table(["category", "readiness", "rows", "interval", "recheck", "clock fix", "pool live"], categoryRows),
    "",
    "## 예시",
    "",
    exampleRows.length ? table(["action", "bucket", "pid", "name", "category", "readiness", "pool", "band", "sold", "last_seen", "search_after"], exampleRows) : "- 예시 없음.",
    "",
    "## 판단",
    "",
    "- `terminal_interval_candidate`는 자동 삭제 대상이 아니라, 과거 terminal interval과 현재 active 상태를 분리해 보관할 후보이다.",
    "- `detail_recheck_required`는 검색 재등장 증거가 약하므로 lifecycle/detail worker가 다시 확인해야 한다.",
    "- `hold_clock_fix`는 시간 순서 자체가 이상하므로 velocity 계산이나 자동 보정에 쓰지 않는다.",
    "",
    "## 다음 액션",
    "",
    "1. 이 리포트 수치를 기준으로 terminal interval schema가 필요한지 결정한다.",
    "2. schema 변경 전에는 candidate pool/live verify에는 현재 active 상태를 우선하고, velocity materialization은 계속 `sold_confirmed`만 판매 표본으로 쓴다.",
    "3. ready category의 interval 후보가 많으면 lifecycle worker가 ready/pool tier를 먼저 처리하도록 우선순위를 검토한다.",
    "",
  ].join("\n");
}

await mkdir(reportsDir, { recursive: true });
const report = await runSql(SQL);
await writeFile(path.join(reportsDir, "terminal-interval-candidates-latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
await writeFile(path.join(reportsDir, "terminal-interval-candidates-latest.md"), renderMarkdown(report), "utf-8");

console.log("wrote reports/terminal-interval-candidates-latest.json");
console.log("wrote reports/terminal-interval-candidates-latest.md");
