import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function num(value) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(value, limit = 64) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

const SQL = `
with current_pending as (
  select
    c.pid,
    c.status as lifecycle_status,
    r.listing_state as raw_state,
    c.priority_tier,
    c.state_reason,
    c.next_check_at,
    c.locked_until,
    c.last_checked_at,
    c.attempts,
    c.max_attempts,
    r.name,
    r.price,
    r.sku_id,
    r.sku_name,
    r.sale_status,
    p.category,
    p.comparable_key,
    cp.status as pool_status,
    cp.profit_band
  from public.mvp_lifecycle_checks c
  join public.mvp_raw_listings r on r.pid = c.pid
  left join public.mvp_listing_parsed p on p.pid = c.pid
  left join public.mvp_candidate_pool cp
    on cp.pid = c.pid
   and cp.status in ('ready','reserved')
  where c.status in ('active','missing_suspect')
    and r.listing_state in ('sold_confirmed','disappeared','archived')
    and c.state_reason = 'terminal_reappeared_in_search'
),
target_existing as (
  select
    c.pid,
    c.status as lifecycle_status,
    r.listing_state as raw_state,
    c.priority_tier,
    c.state_reason,
    c.next_check_at,
    c.locked_until,
    c.attempts,
    c.max_attempts,
    cp.status as pool_status
  from public.mvp_lifecycle_checks c
  join public.mvp_raw_listings r on r.pid = c.pid
  left join public.mvp_candidate_pool cp
    on cp.pid = c.pid
   and cp.status in ('ready','reserved')
  where c.status in ('sold_confirmed','disappeared','archived')
    and r.listing_state in ('sold_confirmed','disappeared','archived')
    and c.state_reason = 'terminal_reappeared_in_search'
),
summary as (
  select
    (select count(*)::int from current_pending) as current_pending_count,
    (select count(*)::int from current_pending where next_check_at <= now()) as current_due_count,
    (select count(*)::int from current_pending where locked_until is not null and locked_until > now()) as current_locked_count,
    (select count(*)::int from current_pending where attempts >= max_attempts) as current_attempt_blocked_count,
    (select count(*)::int from current_pending where pool_status in ('ready','reserved')) as current_pool_count,
    (select count(*)::int from target_existing) as target_existing_count,
    (select count(*)::int from target_existing where next_check_at <= now()) as target_existing_due_count,
    (select count(*)::int from target_existing where pool_status in ('ready','reserved')) as target_existing_pool_count,
    (select count(*)::int from current_pending) as option_a_simulated_target_count
)
select json_build_object(
  'generated_at', now(),
  'mode', 'no-mutation-dry-run',
  'summary', (select row_to_json(summary) from summary),
  'by_category', coalesce((select json_agg(row_to_json(t)) from (
    select coalesce(category, 'unknown') as category, count(*)::int as count
    from current_pending
    group by coalesce(category, 'unknown')
    order by count desc, category
  ) t), '[]'::json),
  'by_tier', coalesce((select json_agg(row_to_json(t)) from (
    select priority_tier, count(*)::int as count
    from current_pending
    group by priority_tier
    order by count desc, priority_tier
  ) t), '[]'::json),
  'pool_impact', coalesce((select json_agg(row_to_json(t)) from (
    select coalesce(pool_status, 'none') as pool_status, coalesce(profit_band::text, '-') as profit_band, count(*)::int as count
    from current_pending
    group by coalesce(pool_status, 'none'), coalesce(profit_band::text, '-')
    order by count desc, pool_status, profit_band
  ) t), '[]'::json),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select
      pid,
      lifecycle_status,
      raw_state,
      priority_tier,
      attempts,
      max_attempts,
      next_check_at,
      last_checked_at,
      name,
      price,
      sku_id,
      sku_name,
      sale_status,
      category,
      comparable_key,
      pool_status,
      profit_band
    from current_pending
    order by
      case when pool_status in ('ready','reserved') then 0 else 1 end,
      next_check_at asc,
      last_checked_at asc nulls first
    limit 80
  ) t), '[]'::json)
) as report;
`;

async function runPsqlJson(sql) {
  const url = dbUrl();
  if (!url) throw new Error("DATABASE_URL/POSTGRES_URL/SUPABASE_DB_URL 필요");
  const { env, args } = psqlArgsFromUrl(url);
  const candidates = [
    process.env.PSQL_BIN,
    "/opt/homebrew/opt/libpq/bin/psql",
    "/opt/homebrew/bin/psql",
    "psql",
  ].filter(Boolean);

  let lastError = null;
  for (const bin of candidates) {
    try {
      const { stdout } = await execFileAsync(bin, [...args, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], {
        env,
        maxBuffer: 20 * 1024 * 1024,
      });
      return JSON.parse(stdout.trim());
    } catch (err) {
      lastError = err;
      if (err?.code !== "ENOENT") break;
    }
  }
  throw lastError ?? new Error("psql 실행 실패");
}

function renderMarkdown(report) {
  const summary = report.summary ?? {};
  return [
    "# Lifecycle Terminal Recheck Model Dry Run",
    "",
    `- generated_at: ${report.generated_at}`,
    `- mode: ${report.mode}`,
    "",
    "## Summary",
    "",
    table(["metric", "value"], [
      ["current pending", num(summary.current_pending_count)],
      ["current due", num(summary.current_due_count)],
      ["current locked", num(summary.current_locked_count)],
      ["current attempt-blocked", num(summary.current_attempt_blocked_count)],
      ["current pool ready/reserved", num(summary.current_pool_count)],
      ["target existing", num(summary.target_existing_count)],
      ["target existing due", num(summary.target_existing_due_count)],
      ["target existing pool ready/reserved", num(summary.target_existing_pool_count)],
      ["option A simulated target", num(summary.option_a_simulated_target_count)],
    ]),
    "",
    "## By Category",
    "",
    table(["category", "count"], (report.by_category ?? []).map((row) => [row.category, num(row.count)])),
    "",
    "## By Priority Tier",
    "",
    table(["tier", "count"], (report.by_tier ?? []).map((row) => [row.priority_tier, num(row.count)])),
    "",
    "## Pool Impact",
    "",
    table(["pool_status", "band", "count"], (report.pool_impact ?? []).map((row) => [row.pool_status, row.profit_band, num(row.count)])),
    "",
    "## Examples",
    "",
    table(
      ["pid", "states", "tier", "attempts", "pool", "sku", "name"],
      (report.examples ?? []).map((row) => [
        row.pid,
        `${row.lifecycle_status} / ${row.raw_state}`,
        row.priority_tier,
        `${row.attempts}/${row.max_attempts}`,
        row.pool_status ? `${row.pool_status}:${row.profit_band ?? "-"}` : "-",
        row.sku_id ?? "-",
        compact(row.name),
      ]),
    ),
    "",
    "## Interpretation",
    "",
    "- `current pending`은 현재 lifecycle status를 queue marker로 쓰고 있는 행이다.",
    "- `target existing`은 이미 status-preserving 모델처럼 표현된 행이다.",
    "- Option A migration은 current pending을 lifecycle terminal 상태로 되돌리고, `state_reason=terminal_reappeared_in_search` + due `next_check_at`으로 claim하게 만드는 방향이다.",
    "- `current pool ready/reserved`가 0이면 pack-open 직접 영향은 낮다.",
    "- 이 리포트는 no-mutation dry-run이며 DB write를 하지 않는다.",
  ].join("\n");
}

const report = await runPsqlJson(SQL);
await mkdir(reportsDir, { recursive: true });
await writeFile(path.join(reportsDir, "lifecycle-terminal-recheck-model-dry-run-latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
await writeFile(path.join(reportsDir, "lifecycle-terminal-recheck-model-dry-run-latest.md"), renderMarkdown(report), "utf-8");

console.log("wrote reports/lifecycle-terminal-recheck-model-dry-run-latest.json");
console.log("wrote reports/lifecycle-terminal-recheck-model-dry-run-latest.md");
console.log(`current_pending=${report.summary?.current_pending_count ?? 0} target_existing=${report.summary?.target_existing_count ?? 0} pool=${report.summary?.current_pool_count ?? 0}`);
