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
  const jsonLine = stdout
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.trim().startsWith("{") || line.trim().startsWith("["));
  if (!jsonLine) {
    throw new Error(`psql did not return JSON output: ${stdout.trim().slice(0, 500)}`);
  }
  return JSON.parse(jsonLine);
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

const mode = arg("apply", "0") === "1" ? "apply" : "dry-run";

const createTableSql = `
create table if not exists public.mvp_market_velocity_daily (
  date date not null,
  comparable_key text not null,
  condition_class text not null default 'all',
  category text,
  family text,
  model text,
  variant_key text,
  observed_sold_sample_count integer not null default 0,
  active_sample_count integer not null default 0,
  sold_24h_count integer not null default 0,
  sold_7d_count integer not null default 0,
  median_hours_to_sold numeric,
  p25_hours_to_sold numeric,
  p75_hours_to_sold numeric,
  confidence text not null default 'low' check (confidence in ('high','medium','low')),
  clock_basis text not null default 'first_seen_to_sold_detected'
    check (clock_basis in ('first_seen_to_sold_detected')),
  computed_at timestamptz not null default now(),
  primary key (date, comparable_key, condition_class)
);

alter table public.mvp_market_velocity_daily
  add column if not exists condition_class text not null default 'all';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mvp_market_velocity_daily'::regclass
      and conname = 'mvp_market_velocity_daily_pkey'
      and array_length(conkey, 1) = 2
  ) then
    alter table public.mvp_market_velocity_daily
      drop constraint mvp_market_velocity_daily_pkey;
    alter table public.mvp_market_velocity_daily
      add constraint mvp_market_velocity_daily_pkey
      primary key (date, comparable_key, condition_class);
  end if;
end $$;

create index if not exists mvp_market_velocity_daily_comparable_date_idx
  on public.mvp_market_velocity_daily(comparable_key, date desc);

create index if not exists mvp_market_velocity_daily_comparable_condition_date_idx
  on public.mvp_market_velocity_daily(comparable_key, condition_class, date desc);

alter table public.mvp_market_velocity_daily enable row level security;
`;

const dailyRowsSql = `
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
    'all'::text as condition_class,
    max(category) as category,
    max(family) as family,
    max(model) as model,
    max(variant_key) as variant_key,
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
    'first_seen_to_sold_detected' as clock_basis,
    now() as computed_at
  from key_velocity k
  left join active_rows a on a.comparable_key = k.comparable_key
)
`;

const dryRunSql = `
${dailyRowsSql}
select json_build_object(
  'mode', 'dry-run',
  'generated_at', now(),
  'summary', json_build_object(
    'candidate_rows', (select count(*)::int from daily_rows),
    'high_count', (select count(*)::int from daily_rows where confidence = 'high'),
    'medium_count', (select count(*)::int from daily_rows where confidence = 'medium'),
    'low_count', (select count(*)::int from daily_rows where confidence = 'low'),
    'sold_sample_count', (select coalesce(sum(observed_sold_sample_count), 0)::int from daily_rows),
    'active_sample_count', (select coalesce(sum(active_sample_count), 0)::int from daily_rows)
  ),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select *
    from daily_rows
    order by case confidence when 'high' then 1 when 'medium' then 2 else 3 end,
      observed_sold_sample_count desc,
      active_sample_count desc,
      comparable_key
    limit 40
  ) t), '[]'::json)
) as report;
`;

const applySql = `
${createTableSql}
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
    extract(epoch from (r.sold_detected_at - r.first_seen_at)) / 3600.0 as hours_to_sold
  from public.mvp_raw_listings r
  join public.mvp_listing_parsed p on p.pid = r.pid
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
    'all'::text as condition_class,
    max(category) as category,
    max(family) as family,
    max(model) as model,
    max(variant_key) as variant_key,
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
    'first_seen_to_sold_detected' as clock_basis,
    now() as computed_at
  from key_velocity k
  left join active_rows a on a.comparable_key = k.comparable_key
),
upserted as (
  insert into public.mvp_market_velocity_daily (
    date,
    comparable_key,
    condition_class,
    category,
    family,
    model,
    variant_key,
    observed_sold_sample_count,
    active_sample_count,
    sold_24h_count,
    sold_7d_count,
    median_hours_to_sold,
    p25_hours_to_sold,
    p75_hours_to_sold,
    confidence,
    clock_basis,
    computed_at
  )
  select
    date,
    comparable_key,
    condition_class,
    category,
    family,
    model,
    variant_key,
    observed_sold_sample_count,
    active_sample_count,
    sold_24h_count,
    sold_7d_count,
    median_hours_to_sold,
    p25_hours_to_sold,
    p75_hours_to_sold,
    confidence,
    clock_basis,
    computed_at
  from daily_rows
  on conflict (date, comparable_key, condition_class) do update set
    category = excluded.category,
    family = excluded.family,
    model = excluded.model,
    variant_key = excluded.variant_key,
    observed_sold_sample_count = excluded.observed_sold_sample_count,
    active_sample_count = excluded.active_sample_count,
    sold_24h_count = excluded.sold_24h_count,
    sold_7d_count = excluded.sold_7d_count,
    median_hours_to_sold = excluded.median_hours_to_sold,
    p25_hours_to_sold = excluded.p25_hours_to_sold,
    p75_hours_to_sold = excluded.p75_hours_to_sold,
    confidence = excluded.confidence,
    clock_basis = excluded.clock_basis,
    computed_at = excluded.computed_at
  returning *
)
select json_build_object(
  'mode', 'apply',
  'generated_at', now(),
  'summary', json_build_object(
    'upserted_rows', (select count(*)::int from upserted),
    'high_count', (select count(*)::int from upserted where confidence = 'high'),
    'medium_count', (select count(*)::int from upserted where confidence = 'medium'),
    'low_count', (select count(*)::int from upserted where confidence = 'low'),
    'sold_sample_count', (select coalesce(sum(observed_sold_sample_count), 0)::int from upserted),
    'active_sample_count', (select coalesce(sum(active_sample_count), 0)::int from upserted)
  ),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select *
    from upserted
    order by case confidence when 'high' then 1 when 'medium' then 2 else 3 end,
      observed_sold_sample_count desc,
      active_sample_count desc,
      comparable_key
    limit 40
  ) t), '[]'::json)
) as report;
`;

function renderMarkdown(report) {
  const s = report.summary ?? {};
  const examples = report.examples ?? [];
  const exampleRows = examples.map((row) => [
    row.confidence,
    row.category ?? "-",
    row.comparable_key,
    num(row.observed_sold_sample_count),
    num(row.active_sample_count),
    num(row.sold_24h_count),
    row.median_hours_to_sold == null ? "-" : `${Number(row.median_hours_to_sold).toFixed(1)}h`,
  ]);

  return [
    "# Market Velocity Sync",
    "",
    `mode: ${report.mode ?? mode}`,
    `generated: ${report.generated_at ?? new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    table(["metric", "value"], [
      [mode === "apply" ? "upserted_rows" : "candidate_rows", num(s.upserted_rows ?? s.candidate_rows)],
      ["high", num(s.high_count)],
      ["medium", num(s.medium_count)],
      ["low", num(s.low_count)],
      ["sold_sample_count", num(s.sold_sample_count)],
      ["active_sample_count", num(s.active_sample_count)],
    ]),
    "",
    "## Examples",
    "",
    table(["confidence", "category", "comparable_key", "sold", "active", "24h sold", "median"], exampleRows),
    "",
    "## 판단",
    "",
    mode === "apply"
      ? "- `mvp_market_velocity_daily`를 생성/갱신했다. UI 사용 전 ready category + medium/high 필터를 유지한다."
      : "- dry-run이다. 운영 DB에는 쓰지 않았다. apply 전 high/medium/low 분포를 확인한다.",
    "",
  ].join("\n");
}

await mkdir(reportsDir, { recursive: true });
const report = await runSql(mode === "apply" ? applySql : dryRunSql);
const suffix = mode === "apply" ? "apply" : "dry-run";
await writeFile(path.join(reportsDir, `market-velocity-sync-${suffix}-latest.json`), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
await writeFile(path.join(reportsDir, `market-velocity-sync-${suffix}-latest.md`), renderMarkdown(report), "utf-8");

console.log(`wrote reports/market-velocity-sync-${suffix}-latest.json`);
console.log(`wrote reports/market-velocity-sync-${suffix}-latest.md`);
