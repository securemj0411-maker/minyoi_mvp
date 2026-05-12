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
      // try next
    }
  }
  return "psql";
}

async function runSql(sql) {
  const rawUrl = dbUrl();
  if (!rawUrl) throw new Error("DATABASE_URL/POSTGRES_URL/POSTGRES_PRISMA_URL/SUPABASE_DB_URL 필요");
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

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(value, max = 62) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

const sampleLimit = intArg("sampleLimit", 80, 20, 300);
const now = new Date();
const outPath = arg("out", path.join(reportsDir, `lifecycle-recheck-drain-plan-${dateStamp(now)}.md`));
const outJson = outPath.replace(/\.md$/i, ".json");
const latestMd = path.join(reportsDir, "lifecycle-recheck-drain-plan-latest.md");
const latestJson = path.join(reportsDir, "lifecycle-recheck-drain-plan-latest.json");

const SQL = `
with due_queue as (
  select
    c.pid,
    c.status,
    c.priority_tier,
    c.next_check_at,
    c.updated_at,
    case
      when r.listing_state in ('sold_confirmed','disappeared','archived')
        and c.status in ('active','missing_suspect')
        then true
      else false
    end as is_terminal_mismatch
  from public.mvp_lifecycle_checks c
  join public.mvp_raw_listings r on r.pid = c.pid
  where c.status in ('active','missing_suspect')
    and c.next_check_at <= now()
    and c.attempts < c.max_attempts
    and (c.locked_until is null or c.locked_until < now())
),
due_ordered as (
  select
    *,
    row_number() over (
      order by
        case priority_tier
          when 'pool' then 0
          when 'near_pool' then 1
          when 'exploration' then 2
          when 'market_sample' then 3
          else 4
        end,
        next_check_at asc,
        updated_at asc
    ) as claim_rank
  from due_queue
),
candidates as (
  select
    c.pid,
    c.status as lifecycle_status,
    c.priority_tier,
    c.state_reason,
    c.next_check_at,
    c.locked_until,
    c.last_checked_at,
    c.transition_confidence,
    c.consecutive_missing_count,
    c.consecutive_error_count,
    r.listing_state as raw_state,
    r.name,
    r.price,
    r.sale_status,
    r.last_seen_at,
    r.detail_enriched_at,
    r.sold_detected_at,
    p.category,
    p.comparable_key,
    coalesce(cr.status, 'missing_readiness') as readiness_status,
    cp.status as pool_status,
    cp.profit_band
  from public.mvp_lifecycle_checks c
  join public.mvp_raw_listings r on r.pid = c.pid
  left join public.mvp_listing_parsed p on p.pid = c.pid
  left join public.mvp_category_readiness cr on cr.category = p.category
  left join public.mvp_candidate_pool cp on cp.pid = c.pid
  where r.listing_state in ('sold_confirmed','disappeared','archived')
    and c.status in ('active','missing_suspect')
),
classified as (
  select
    *,
    case
      when pool_status in ('ready','reserved') then 'pool_first_recheck'
      when priority_tier = 'pool' then 'pool_tier_recheck'
      when readiness_status = 'ready' then 'ready_category_recheck'
      when priority_tier = 'market_sample' then 'market_sample_stagger'
      else 'low_priority_stagger'
    end as drain_bucket,
    case
      when next_check_at is null or next_check_at <= now() then true
      else false
    end as due_now,
    greatest(0, extract(epoch from (now() - coalesce(last_checked_at, next_check_at, now()))) / 3600.0) as hours_since_check
  from candidates
),
summary as (
  select
    count(*)::int as total,
    count(*) filter (where due_now)::int as due_now,
    count(*) filter (where locked_until is not null and locked_until > now())::int as locked,
    count(*) filter (where pool_status in ('ready','reserved'))::int as active_pool_overlap,
    count(*) filter (where readiness_status = 'ready')::int as ready_category_rows,
    count(*) filter (where priority_tier = 'pool')::int as pool_tier_rows,
    count(*) filter (where priority_tier = 'market_sample')::int as market_sample_rows,
    percentile_cont(0.5) within group (order by hours_since_check) as median_hours_since_check,
    percentile_cont(0.95) within group (order by hours_since_check) as p95_hours_since_check
  from classified
)
select json_build_object(
  'generated_at', now(),
  'summary', (select row_to_json(summary) from summary),
  'due_queue', json_build_object(
    'total_due', (select count(*)::int from due_queue),
    'terminal_mismatch_due', (select count(*)::int from due_queue where is_terminal_mismatch),
    'terminal_mismatch_first_rank', (select min(claim_rank)::int from due_ordered where is_terminal_mismatch),
    'terminal_mismatch_median_rank', (select percentile_cont(0.5) within group(order by claim_rank) from due_ordered where is_terminal_mismatch),
    'terminal_mismatch_last_rank', (select max(claim_rank)::int from due_ordered where is_terminal_mismatch),
    'next_20_mismatch_count', (select count(*)::int from due_ordered where claim_rank <= 20 and is_terminal_mismatch)
  ),
  'due_queue_by_tier', coalesce((select json_agg(row_to_json(t)) from (
    select
      coalesce(priority_tier, 'unknown') as priority_tier,
      count(*)::int as rows,
      count(*) filter (where is_terminal_mismatch)::int as terminal_mismatch_rows
    from due_queue
    group by coalesce(priority_tier, 'unknown')
    order by rows desc, priority_tier
  ) t), '[]'::json),
  'by_drain_bucket', coalesce((select json_agg(row_to_json(t)) from (
    select
      drain_bucket,
      count(*)::int as rows,
      count(*) filter (where due_now)::int as due_now,
      count(*) filter (where locked_until is not null and locked_until > now())::int as locked,
      count(*) filter (where readiness_status = 'ready')::int as ready_rows,
      count(*) filter (where pool_status in ('ready','reserved'))::int as active_pool_overlap,
      max(last_seen_at) as latest_last_seen_at,
      min(next_check_at) as earliest_next_check_at
    from classified
    group by drain_bucket
    order by
      case drain_bucket
        when 'pool_first_recheck' then 0
        when 'pool_tier_recheck' then 1
        when 'ready_category_recheck' then 2
        when 'market_sample_stagger' then 3
        else 4
      end
  ) t), '[]'::json),
  'by_category', coalesce((select json_agg(row_to_json(t)) from (
    select
      coalesce(category, 'unknown') as category,
      readiness_status,
      count(*)::int as rows,
      count(*) filter (where due_now)::int as due_now,
      count(*) filter (where priority_tier = 'pool')::int as pool_tier_rows,
      count(*) filter (where pool_status in ('ready','reserved'))::int as active_pool_overlap
    from classified
    group by coalesce(category, 'unknown'), readiness_status
    order by rows desc, category
  ) t), '[]'::json),
  'by_priority_tier', coalesce((select json_agg(row_to_json(t)) from (
    select
      coalesce(priority_tier, 'unknown') as priority_tier,
      count(*)::int as rows,
      count(*) filter (where due_now)::int as due_now,
      max(hours_since_check) as max_hours_since_check
    from classified
    group by coalesce(priority_tier, 'unknown')
    order by rows desc, priority_tier
  ) t), '[]'::json),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select
      pid,
      drain_bucket,
      lifecycle_status,
      raw_state,
      priority_tier,
      readiness_status,
      pool_status,
      profit_band,
      category,
      comparable_key,
      state_reason,
      name,
      price,
      sale_status,
      last_seen_at,
      detail_enriched_at,
      sold_detected_at,
      next_check_at,
      last_checked_at,
      transition_confidence
    from classified
    order by
      case drain_bucket
        when 'pool_first_recheck' then 0
        when 'pool_tier_recheck' then 1
        when 'ready_category_recheck' then 2
        when 'market_sample_stagger' then 3
        else 4
      end,
      due_now desc,
      hours_since_check desc,
      pid desc
    limit ${sampleLimit}
  ) t), '[]'::json)
) as report;
`;

const report = await runSql(SQL);
const s = report.summary ?? {};
const q = report.due_queue ?? {};

const recommendations = [];
if (Number(s.active_pool_overlap ?? 0) > 0) {
  recommendations.push("ready/reserved pool과 겹치는 row가 있으므로 pool 우선 재확인을 먼저 처리한다.");
} else {
  recommendations.push("ready/reserved pool과 겹치는 row가 없어 현재 공개 후보를 즉시 오염시키는 상태는 아니다.");
}
if (Number(s.total ?? 0) > 0) {
  recommendations.push("자동 상태 변경보다 lifecycle worker 재확인을 우선한다. raw는 terminal이고 lifecycle은 open이므로 detail API 재확인이 안전한 소스다.");
  recommendations.push("한 번에 256건을 밀지 말고 pool/ready category부터 소량 배치로 처리한 뒤 market_sample을 stagger한다.");
}
if (Number(q.terminal_mismatch_median_rank ?? 0) > 1000) {
  recommendations.push("현재 claim 순서에서 terminal mismatch 중앙 rank가 높아 자연 배수만으로는 느리다. 상태 변경이 아니라 targeted claim/우선순위 정책을 별도 설계한다.");
}
recommendations.push("raw touch coalescing의 실제 write skip은 이 recheck backlog가 줄어든 뒤 재검토한다.");

const md = `# Lifecycle Recheck Drain Plan

- generated_at: ${report.generated_at}
- scope: raw terminal / lifecycle open mismatch only

## 요약

${table(
  ["항목", "값"],
  [
    ["total", num(s.total)],
    ["due now", num(s.due_now)],
    ["locked", num(s.locked)],
    ["active pool overlap", num(s.active_pool_overlap)],
    ["ready category rows", num(s.ready_category_rows)],
    ["pool tier rows", num(s.pool_tier_rows)],
    ["market sample rows", num(s.market_sample_rows)],
    ["median hours since check", Number(s.median_hours_since_check ?? 0).toFixed(1)],
    ["p95 hours since check", Number(s.p95_hours_since_check ?? 0).toFixed(1)],
  ],
)}

## 전체 Due Queue 경쟁

${table(
  ["항목", "값"],
  [
    ["total due", num(q.total_due)],
    ["terminal mismatch due", num(q.terminal_mismatch_due)],
    ["mismatch first claim rank", num(q.terminal_mismatch_first_rank)],
    ["mismatch median claim rank", Number(q.terminal_mismatch_median_rank ?? 0).toFixed(1)],
    ["mismatch last claim rank", num(q.terminal_mismatch_last_rank)],
    ["next 20 mismatch count", num(q.next_20_mismatch_count)],
  ],
)}

${table(
  ["priority", "due rows", "terminal mismatch rows"],
  (report.due_queue_by_tier ?? []).map((row) => [
    row.priority_tier,
    num(row.rows),
    num(row.terminal_mismatch_rows),
  ]),
)}

## 권장 처리

${recommendations.map((item) => `- ${item}`).join("\n")}

## Drain Bucket

${table(
  ["bucket", "rows", "due", "locked", "ready", "pool overlap", "earliest next check"],
  (report.by_drain_bucket ?? []).map((row) => [
    row.drain_bucket,
    num(row.rows),
    num(row.due_now),
    num(row.locked),
    num(row.ready_rows),
    num(row.active_pool_overlap),
    row.earliest_next_check_at ?? "-",
  ]),
)}

## Category

${table(
  ["category", "readiness", "rows", "due", "pool tier", "pool overlap"],
  (report.by_category ?? []).map((row) => [
    row.category,
    row.readiness_status,
    num(row.rows),
    num(row.due_now),
    num(row.pool_tier_rows),
    num(row.active_pool_overlap),
  ]),
)}

## Priority Tier

${table(
  ["priority", "rows", "due", "max hours since check"],
  (report.by_priority_tier ?? []).map((row) => [
    row.priority_tier,
    num(row.rows),
    num(row.due_now),
    Number(row.max_hours_since_check ?? 0).toFixed(1),
  ]),
)}

## Examples

${table(
  ["pid", "bucket", "tier", "category", "pool", "state", "name", "price"],
  (report.examples ?? []).slice(0, 30).map((row) => [
    row.pid,
    row.drain_bucket,
    row.priority_tier,
    row.category ?? "-",
    row.pool_status ?? "-",
    `${row.lifecycle_status}/${row.raw_state}`,
    compact(row.name),
    num(row.price),
  ]),
)}
`;

const summary = {
  ...report,
  recommendations,
};

await mkdir(reportsDir, { recursive: true });
await writeFile(outPath, md, "utf-8");
await writeFile(outJson, JSON.stringify(summary, null, 2), "utf-8");
await writeFile(latestMd, md, "utf-8");
await writeFile(latestJson, JSON.stringify(summary, null, 2), "utf-8");

console.log(`wrote ${outPath}`);
console.log(`wrote ${outJson}`);
