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

function compactName(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 52 ? `${text.slice(0, 52)}...` : text;
}

const sampleLimit = intArg("sampleLimit", 80, 10, 500);

const SQL = `
with joined as (
  select
    c.pid,
    c.status as lifecycle_status,
    r.listing_state as raw_state,
    c.priority_tier,
    c.state_reason,
    c.next_check_at,
    c.locked_until,
    c.last_checked_at,
    c.updated_at as lifecycle_updated_at,
    c.transition_confidence,
    c.consecutive_missing_count,
    c.consecutive_error_count,
    r.name,
    r.price,
    r.sku_id,
    r.sku_name,
    r.sale_status,
    r.last_seen_at,
    r.detail_enriched_at,
    r.sold_detected_at,
    r.disappeared_at,
    r.missing_count,
    r.last_missing_at,
    p.category,
    p.comparable_key,
    p.parse_confidence,
    p.needs_review,
    case
      when c.status in ('sold_confirmed','disappeared','archived') and r.listing_state = 'active'
        then 'lifecycle_terminal_raw_active'
      when r.listing_state in ('sold_confirmed','disappeared','archived') and c.status in ('active','missing_suspect')
        then 'raw_terminal_lifecycle_open'
      when c.status = 'missing_suspect' and r.listing_state = 'active'
        then 'lifecycle_missing_raw_active'
      when c.status = 'active' and r.listing_state = 'missing_suspect'
        then 'lifecycle_active_raw_missing'
      else 'other_state_mismatch'
    end as mismatch_type,
    case
      when c.status in ('sold_confirmed','disappeared','archived')
        and r.listing_state = 'active'
        and c.state_reason like 'backfill_sale_status_inactive%'
        then 'auto_sync_raw_to_lifecycle_candidate'
      when c.status in ('sold_confirmed','disappeared','archived')
        and r.listing_state = 'active'
        and c.state_reason like 'sold_signal_%'
        then 'auto_sync_raw_to_lifecycle_candidate'
      when c.status in ('sold_confirmed','disappeared','archived')
        and r.listing_state = 'active'
        then 'detail_recheck_required'
      when r.listing_state in ('sold_confirmed','disappeared','archived')
        and c.status in ('active','missing_suspect')
        and c.state_reason = 'terminal_reappeared_in_search'
        then 'terminal_recheck_pending'
      when r.listing_state in ('sold_confirmed','disappeared','archived')
        and c.status in ('active','missing_suspect')
        then 'lifecycle_recheck_required'
      when c.status = 'missing_suspect' and r.listing_state = 'active'
        then 'search_recovered_review'
      else 'manual_review'
    end as action_bucket
  from public.mvp_lifecycle_checks c
  join public.mvp_raw_listings r on r.pid = c.pid
  left join public.mvp_listing_parsed p on p.pid = c.pid
  where c.status is distinct from r.listing_state
),
summary as (
  select
    count(*) as total,
    count(*) filter (where action_bucket = 'auto_sync_raw_to_lifecycle_candidate') as auto_sync_candidates,
    count(*) filter (where action_bucket like '%recheck_required') as recheck_required,
    count(*) filter (where action_bucket = 'terminal_recheck_pending') as terminal_recheck_pending,
    count(*) filter (where action_bucket = 'manual_review') as manual_review
  from joined
)
select json_build_object(
  'generated_at', now(),
  'summary', (select row_to_json(summary) from summary),
  'counts_by_type', coalesce((select json_agg(row_to_json(t)) from (
    select mismatch_type, count(*)::int as count
    from joined
    group by mismatch_type
    order by count desc, mismatch_type
  ) t), '[]'::json),
  'counts_by_action', coalesce((select json_agg(row_to_json(t)) from (
    select action_bucket, count(*)::int as count
    from joined
    group by action_bucket
    order by count desc, action_bucket
  ) t), '[]'::json),
  'counts_by_state_pair', coalesce((select json_agg(row_to_json(t)) from (
    select lifecycle_status, raw_state, count(*)::int as count
    from joined
    group by lifecycle_status, raw_state
    order by count desc, lifecycle_status, raw_state
  ) t), '[]'::json),
  'top_reasons', coalesce((select json_agg(row_to_json(t)) from (
    select coalesce(nullif(state_reason, ''), '-') as state_reason, count(*)::int as count
    from joined
    group by coalesce(nullif(state_reason, ''), '-')
    order by count desc, state_reason
    limit 20
  ) t), '[]'::json),
  'queue_by_action_tier', coalesce((select json_agg(row_to_json(t)) from (
    select
      action_bucket,
      coalesce(nullif(priority_tier, ''), 'unknown') as priority_tier,
      count(*)::int as count,
      count(*) filter (where next_check_at is null or next_check_at <= now())::int as due_count,
      count(*) filter (where locked_until is not null and locked_until > now())::int as locked_count,
      min(next_check_at) as earliest_next_check_at,
      max(last_checked_at) as latest_last_checked_at
    from joined
    group by action_bucket, coalesce(nullif(priority_tier, ''), 'unknown')
    order by
      case action_bucket
        when 'auto_sync_raw_to_lifecycle_candidate' then 0
        when 'detail_recheck_required' then 1
        when 'terminal_recheck_pending' then 2
        when 'lifecycle_recheck_required' then 3
        when 'search_recovered_review' then 4
        else 4
      end,
      due_count desc,
      count desc,
      priority_tier
  ) t), '[]'::json),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select
      pid,
      mismatch_type,
      action_bucket,
      lifecycle_status,
      raw_state,
      priority_tier,
      state_reason,
      name,
      price,
      sku_id,
      sku_name,
      sale_status,
      category,
      comparable_key,
      last_seen_at,
      detail_enriched_at,
      sold_detected_at,
      disappeared_at,
      next_check_at,
      locked_until,
      last_checked_at,
      transition_confidence
    from joined
    order by
      case action_bucket
        when 'auto_sync_raw_to_lifecycle_candidate' then 0
        when 'detail_recheck_required' then 1
        when 'terminal_recheck_pending' then 2
        when 'lifecycle_recheck_required' then 3
        when 'search_recovered_review' then 4
        else 4
      end,
      lifecycle_updated_at desc nulls last
    limit ${sampleLimit}
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
  const examples = report.examples ?? [];
  return [
    "# Lifecycle State Mismatch Report",
    "",
    `- generated_at: ${report.generated_at}`,
    `- total_mismatch: ${num(summary.total)}`,
    `- auto_sync_candidates: ${num(summary.auto_sync_candidates)}`,
    `- recheck_required: ${num(summary.recheck_required)}`,
    `- terminal_recheck_pending: ${num(summary.terminal_recheck_pending)}`,
    `- manual_review: ${num(summary.manual_review)}`,
    "",
    "## Counts By Type",
    "",
    table(["type", "count"], (report.counts_by_type ?? []).map((row) => [row.mismatch_type, num(row.count)])),
    "",
    "## Counts By Action",
    "",
    table(["action", "count"], (report.counts_by_action ?? []).map((row) => [row.action_bucket, num(row.count)])),
    "",
    "## State Pairs",
    "",
    table(["lifecycle", "raw", "count"], (report.counts_by_state_pair ?? []).map((row) => [row.lifecycle_status, row.raw_state, num(row.count)])),
    "",
    "## Top State Reasons",
    "",
    table(["reason", "count"], (report.top_reasons ?? []).map((row) => [row.state_reason, num(row.count)])),
    "",
    "## Queue By Action / Tier",
    "",
    table(
      ["action", "tier", "count", "due", "locked", "earliest next", "latest checked"],
      (report.queue_by_action_tier ?? []).map((row) => [
        row.action_bucket,
        row.priority_tier,
        num(row.count),
        num(row.due_count),
        num(row.locked_count),
        row.earliest_next_check_at ?? "-",
        row.latest_last_checked_at ?? "-",
      ]),
    ),
    "",
    "## Examples",
    "",
    table(
      ["pid", "action", "type", "states", "price", "sku", "reason", "name"],
      examples.map((row) => [
        row.pid,
        row.action_bucket,
        row.mismatch_type,
        `${row.lifecycle_status} / ${row.raw_state}`,
        num(row.price),
        row.sku_id ?? "-",
        row.state_reason || "-",
        compactName(row.name),
      ]),
    ),
    "",
    "## Suggested Handling",
    "",
    "- `auto_sync_raw_to_lifecycle_candidate`: raw가 active로 남아 있지만 lifecycle이 sold/disappeared를 더 강하게 말하는 후보. 일괄 정리 가능성이 높지만 적용 전 샘플 확인 필요.",
    "- `detail_recheck_required`: terminal lifecycle이나 근거가 약해 상세 재확인 후 raw 동기화.",
    "- `terminal_recheck_pending`: 검색에서 terminal raw가 다시 보였기 때문에 상세 재확인을 기다리는 의도된 대기열. 현재 설계상 lifecycle status를 큐 상태로 써서 mismatch처럼 보이므로 별도 structural 개선 후보.",
    "- `lifecycle_recheck_required`: raw가 terminal인데 lifecycle이 열려 있는 후보. lifecycle queue를 terminal/재확인으로 맞춤.",
    "- `search_recovered_review`: 검색 재등장으로 active가 된 후보. 방금 추가한 terminal 보호 이후 새로 발생하는지 추적.",
  ].join("\n");
}

const report = await runPsqlJson(SQL);
await mkdir(reportsDir, { recursive: true });
await writeFile(path.join(reportsDir, "lifecycle-mismatch-latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
await writeFile(path.join(reportsDir, "lifecycle-mismatch-latest.md"), renderMarkdown(report), "utf-8");

console.log("wrote reports/lifecycle-mismatch-latest.json");
console.log("wrote reports/lifecycle-mismatch-latest.md");
console.log(`total=${report.summary?.total ?? 0} auto_sync=${report.summary?.auto_sync_candidates ?? 0} recheck=${report.summary?.recheck_required ?? 0} terminal_pending=${report.summary?.terminal_recheck_pending ?? 0}`);
