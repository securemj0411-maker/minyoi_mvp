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

function pct(part, total, digits = 1) {
  const p = Number(part ?? 0);
  const t = Number(total ?? 0);
  if (!t) return "0.0%";
  return `${((p / t) * 100).toFixed(digits)}%`;
}

function hours(value) {
  if (value == null) return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (n < 24) return `${n.toFixed(1)}h`;
  return `${(n / 24).toFixed(1)}d`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

const limit = intArg("limit", 80, 10, 300);
const minSold = intArg("minSold", 1, 1, 50);

const SQL = `
with eligible as (
  select
    r.pid,
    r.listing_state,
    r.listing_type,
    r.first_seen_at,
    r.sold_detected_at,
    p.category,
    p.family,
    p.model,
    p.variant_key,
    p.comparable_key,
    c.status as category_status,
    extract(epoch from (r.sold_detected_at - r.first_seen_at)) / 3600.0 as hours_to_sold
  from public.mvp_raw_listings r
  join public.mvp_listing_parsed p on p.pid = r.pid
  left join public.mvp_category_readiness c on c.category = p.category
  where p.comparable_key is not null
    and p.comparable_key <> ''
    and r.listing_type = 'normal'
),
sold_rows as (
  select *
  from eligible
  where listing_state = 'sold_confirmed'
    and sold_detected_at is not null
    and sold_detected_at >= first_seen_at
),
active_rows as (
  select comparable_key, count(*)::int as active_sample_count
  from eligible
  where listing_state = 'active'
  group by comparable_key
),
key_velocity as (
  select
    current_date as date,
    comparable_key,
    max(category) as category,
    max(family) as family,
    max(model) as model,
    max(variant_key) as variant_key,
    max(coalesce(category_status, 'missing_readiness')) as category_status,
    count(*)::int as observed_sold_sample_count,
    count(*) filter (where sold_detected_at >= now() - interval '24 hours')::int as sold_24h_count,
    count(*) filter (where sold_detected_at >= now() - interval '7 days')::int as sold_7d_count,
    percentile_cont(0.25) within group (order by hours_to_sold) as p25_hours_to_sold,
    percentile_cont(0.50) within group (order by hours_to_sold) as median_hours_to_sold,
    percentile_cont(0.75) within group (order by hours_to_sold) as p75_hours_to_sold
  from sold_rows
  group by comparable_key
),
daily_rows as (
  select
    k.*,
    coalesce(a.active_sample_count, 0)::int as active_sample_count,
    case
      when k.observed_sold_sample_count >= 20 then 'high'
      when k.observed_sold_sample_count >= 8 then 'medium'
      else 'low'
    end as confidence,
    'first_seen_to_sold_detected' as clock_basis
  from key_velocity k
  left join active_rows a on a.comparable_key = k.comparable_key
  where k.observed_sold_sample_count >= ${minSold}
),
summary as (
  select
    count(*)::int as key_count,
    count(*) filter (where confidence = 'high')::int as high_count,
    count(*) filter (where confidence = 'medium')::int as medium_count,
    count(*) filter (where confidence = 'low')::int as low_count,
    count(*) filter (where category_status = 'ready')::int as ready_key_count,
    count(*) filter (where category_status = 'internal_only')::int as internal_key_count,
    count(*) filter (where category_status = 'blocked')::int as blocked_key_count,
    sum(observed_sold_sample_count)::int as sold_sample_count,
    sum(active_sample_count)::int as active_sample_count
  from daily_rows
),
materialized_summary as (
  select
    count(*)::int as rows,
    count(*) filter (where confidence = 'high')::int as high_count,
    count(*) filter (where confidence = 'medium')::int as medium_count,
    count(*) filter (where confidence = 'low')::int as low_count,
    coalesce(sum(observed_sold_sample_count), 0)::int as sold_sample_count,
    coalesce(sum(active_sample_count), 0)::int as active_sample_count,
    max(date) as latest_date,
    max(computed_at) as latest_computed_at
  from public.mvp_market_velocity_daily
),
category_summary as (
  select
    category,
    category_status,
    count(*)::int as key_count,
    sum(observed_sold_sample_count)::int as sold_sample_count,
    sum(active_sample_count)::int as active_sample_count,
    count(*) filter (where confidence = 'high')::int as high_count,
    count(*) filter (where confidence = 'medium')::int as medium_count,
    percentile_cont(0.50) within group (order by median_hours_to_sold) as median_key_hours
  from daily_rows
  group by category, category_status
),
top_keys as (
  select *
  from daily_rows
  order by
    case confidence when 'high' then 1 when 'medium' then 2 else 3 end,
    observed_sold_sample_count desc,
    active_sample_count desc,
    comparable_key
  limit ${limit}
)
select json_build_object(
  'generated_at', now(),
  'parameters', json_build_object('limit', ${limit}, 'min_sold', ${minSold}),
  'summary', (select row_to_json(summary) from summary),
  'materialized_summary', (select row_to_json(materialized_summary) from materialized_summary),
  'category_summary', coalesce((select json_agg(row_to_json(t)) from (
    select * from category_summary order by sold_sample_count desc, key_count desc, category
  ) t), '[]'::json),
  'top_keys', coalesce((select json_agg(row_to_json(t)) from top_keys t), '[]'::json)
) as report;
`;

function renderMarkdown(report) {
  const summary = report.summary ?? {};
  const materialized = report.materialized_summary ?? {};
  const generatedAt = report.generated_at ?? new Date().toISOString();
  const categoryRows = (report.category_summary ?? []).map((row) => [
    row.category ?? "-",
    row.category_status ?? "-",
    num(row.key_count),
    num(row.sold_sample_count),
    num(row.active_sample_count),
    num(row.high_count),
    num(row.medium_count),
    hours(row.median_key_hours),
  ]);
  const topRows = (report.top_keys ?? []).map((row) => [
    row.confidence,
    row.category ?? "-",
    row.category_status ?? "-",
    row.comparable_key,
    num(row.observed_sold_sample_count),
    num(row.active_sample_count),
    num(row.sold_24h_count),
    hours(row.p25_hours_to_sold),
    hours(row.median_hours_to_sold),
    hours(row.p75_hours_to_sold),
  ]);

  return [
    "# Market Velocity Daily 설계 리포트",
    "",
    `생성: ${generatedAt}`,
    "",
    "## 목적",
    "",
    "- SKU/comparable_key별 판매속도는 업로드 시각이 아니라 관측 가능한 `first_seen_at -> sold_detected_at` 기준으로 먼저 쌓는다.",
    "- `source_updated_at`은 수정/재노출 보조 신호이며 이 리포트의 속도 계산에는 사용하지 않는다.",
    "- 표본 8건 이상부터 medium, 20건 이상부터 high confidence로 본다.",
    "",
    "## 요약",
    "",
    table(["항목", "값"], [
      ["velocity key", num(summary.key_count)],
      ["high confidence", `${num(summary.high_count)} (${pct(summary.high_count, summary.key_count)})`],
      ["medium confidence", `${num(summary.medium_count)} (${pct(summary.medium_count, summary.key_count)})`],
      ["low confidence", `${num(summary.low_count)} (${pct(summary.low_count, summary.key_count)})`],
      ["ready category key", num(summary.ready_key_count)],
      ["internal_only category key", num(summary.internal_key_count)],
      ["blocked category key", num(summary.blocked_key_count)],
      ["sold samples", num(summary.sold_sample_count)],
      ["active samples", num(summary.active_sample_count)],
    ]),
    "",
    "## 현재 Materialized Table",
    "",
    table(["항목", "값"], [
      ["mvp_market_velocity_daily rows", num(materialized.rows)],
      ["latest date", materialized.latest_date ?? "-"],
      ["latest computed", materialized.latest_computed_at ?? "-"],
      ["high", num(materialized.high_count)],
      ["medium", num(materialized.medium_count)],
      ["low", num(materialized.low_count)],
      ["materialized sold samples", num(materialized.sold_sample_count)],
      ["materialized active samples", num(materialized.active_sample_count)],
    ]),
    "",
    "## 카테고리별",
    "",
    table(["category", "readiness", "keys", "sold", "active", "high", "medium", "median"], categoryRows),
    "",
    "## 상위 velocity key",
    "",
    table(["confidence", "category", "readiness", "comparable_key", "sold", "active", "24h sold", "p25", "median", "p75"], topRows),
    "",
    "## DDL 참고",
    "",
    "```sql",
    "create table if not exists public.mvp_market_velocity_daily (",
    "  date date not null,",
    "  comparable_key text not null,",
    "  category text, family text, model text, variant_key text,",
    "  observed_sold_sample_count integer not null default 0,",
    "  active_sample_count integer not null default 0,",
    "  sold_24h_count integer not null default 0,",
    "  sold_7d_count integer not null default 0,",
    "  median_hours_to_sold numeric,",
    "  p25_hours_to_sold numeric,",
    "  p75_hours_to_sold numeric,",
    "  confidence text not null default 'low' check (confidence in ('high','medium','low')),",
    "  clock_basis text not null default 'first_seen_to_sold_detected',",
    "  computed_at timestamptz not null default now(),",
    "  primary key (date, comparable_key)",
    ");",
    "```",
    "",
    "## 결정",
    "",
    "- 이 리포트는 read-only이며 운영 DB를 변경하지 않는다.",
    "- `mvp_market_velocity_daily`는 이미 생성/갱신되어 있다. 새 DDL보다 기존 sync 결과와 공개 필터의 품질을 검증한다.",
    "- 공개 UI에는 ready category + medium/high confidence부터 노출한다.",
    "",
  ].join("\n");
}

await mkdir(reportsDir, { recursive: true });
const report = await runSql(SQL);
await writeFile(path.join(reportsDir, "market-velocity-latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
await writeFile(path.join(reportsDir, "market-velocity-latest.md"), renderMarkdown(report), "utf-8");

console.log("wrote reports/market-velocity-latest.json");
console.log("wrote reports/market-velocity-latest.md");
