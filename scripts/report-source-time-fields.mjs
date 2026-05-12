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

function intArg(name, fallback, min, max) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number.parseInt(raw ?? String(fallback), 10);
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
      // next
    }
  }
  return "psql";
}

async function runSql(sql) {
  const rawUrl = dbUrl();
  if (!rawUrl) throw new Error("DATABASE_URL/POSTGRES_URL/POSTGRES_PRISMA_URL/SUPABASE_DB_URL is required.");
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

function pct(part, total) {
  const p = Number(part ?? 0);
  const t = Number(total ?? 0);
  if (!t) return "0.0%";
  return `${((p / t) * 100).toFixed(1)}%`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(value, max = 56) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const sampleLimit = intArg("sampleLimit", 60, 10, 300);

const SQL = `
with raw as (
  select
    pid,
    name,
    listing_state,
    first_seen_at,
    last_seen_at,
    source_uploaded_at,
    source_updated_at,
    sold_detected_at,
    raw_json #>> '{search,update_time}' as search_update_time,
    raw_json #>> '{searchMeta,updateTime}' as search_meta_update_time,
    raw_json #>> '{search,num_update_time}' as search_num_update_time,
    raw_json #>> '{search,updateTime}' as search_camel_update_time,
    raw_json #>> '{search,created_at}' as search_created_at,
    raw_json #>> '{search,updated_at}' as search_updated_at
  from public.mvp_raw_listings
),
normalized as (
  select
    *,
    coalesce(search_update_time, search_meta_update_time, search_num_update_time, search_camel_update_time) as update_raw
  from raw
),
parsed as (
  select
    *,
    case
      when update_raw ~ '^\\d+(\\.\\d+)?$' then update_raw::numeric
      else null
    end as update_num,
    case
      when update_raw ~ '^\\d+(\\.\\d+)?$' and update_raw::numeric > 1000000000000
        then to_timestamp(update_raw::numeric / 1000.0)
      when update_raw ~ '^\\d+(\\.\\d+)?$' and update_raw::numeric > 1000000000
        then to_timestamp(update_raw::numeric)
      else null
    end as update_ts
  from normalized
),
quality as (
  select
    count(*)::int as total,
    count(*) filter (where search_update_time is not null)::int as search_update_time_present,
    count(*) filter (where search_meta_update_time is not null)::int as search_meta_update_time_present,
    count(*) filter (where update_raw is not null)::int as any_update_raw_present,
    count(*) filter (where update_ts is not null)::int as update_ts_parseable,
    count(*) filter (where update_ts is not null and update_ts between timestamp with time zone '2020-01-01' and now() + interval '1 day')::int as update_ts_plausible,
    count(*) filter (where update_ts is not null and update_ts > now() + interval '1 day')::int as update_ts_future,
    count(*) filter (where update_ts is not null and update_ts < timestamp with time zone '2020-01-01')::int as update_ts_too_old,
    count(*) filter (where update_ts is not null and first_seen_at is not null and update_ts > first_seen_at + interval '10 minutes')::int as update_after_first_seen,
    count(*) filter (where update_ts is not null and first_seen_at is not null and update_ts <= first_seen_at + interval '10 minutes')::int as update_before_or_near_first_seen,
    min(update_ts) as min_update_ts,
    max(update_ts) as max_update_ts
  from parsed
),
delta_summary as (
  select
    percentile_cont(0.10) within group (order by extract(epoch from (first_seen_at - update_ts)) / 3600.0) as first_minus_update_p10_h,
    percentile_cont(0.50) within group (order by extract(epoch from (first_seen_at - update_ts)) / 3600.0) as first_minus_update_p50_h,
    percentile_cont(0.90) within group (order by extract(epoch from (first_seen_at - update_ts)) / 3600.0) as first_minus_update_p90_h,
    percentile_cont(0.50) within group (order by extract(epoch from (sold_detected_at - update_ts)) / 3600.0)
      filter (where sold_detected_at is not null and sold_detected_at >= update_ts) as sold_minus_update_p50_h
  from parsed
  where update_ts is not null
    and update_ts between timestamp with time zone '2020-01-01' and now() + interval '1 day'
),
raw_key_samples as (
  select
    pid,
    name,
    jsonb_object_keys(coalesce(raw_json -> 'search', '{}'::jsonb)) as key
  from public.mvp_raw_listings
  where raw_json ? 'search'
  limit 2000
),
key_counts as (
  select key, count(*)::int as count
  from raw_key_samples
  group by key
),
examples as (
  select
    pid,
    name,
    listing_state,
    first_seen_at,
    last_seen_at,
    sold_detected_at,
    update_raw,
    update_ts,
    extract(epoch from (first_seen_at - update_ts)) / 3600.0 as first_minus_update_h,
    case
      when update_ts is null then 'not_parseable'
      when update_ts > now() + interval '1 day' then 'future'
      when update_ts < timestamp with time zone '2020-01-01' then 'too_old'
      when update_ts > first_seen_at + interval '10 minutes' then 'after_first_seen'
      else 'plausible'
    end as bucket
  from parsed
  where update_raw is not null
  order by
    case
      when update_ts is null then 0
      when update_ts > now() + interval '1 day' then 1
      when update_ts < timestamp with time zone '2020-01-01' then 2
      when update_ts > first_seen_at + interval '10 minutes' then 3
      else 4
    end,
    first_seen_at desc
  limit ${sampleLimit}
)
select json_build_object(
  'generated_at', now(),
  'quality', (select row_to_json(quality) from quality),
  'delta_summary', (select row_to_json(delta_summary) from delta_summary),
  'search_key_counts', coalesce((select json_agg(row_to_json(t)) from (
    select * from key_counts order by count desc, key limit 50
  ) t), '[]'::json),
  'examples', coalesce((select json_agg(row_to_json(t)) from examples t), '[]'::json)
) as report;
`;

function hours(value) {
  if (value == null) return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) < 24) return `${n.toFixed(1)}h`;
  return `${(n / 24).toFixed(1)}d`;
}

function renderMarkdown(report) {
  const q = report.quality ?? {};
  const d = report.delta_summary ?? {};
  const total = Number(q.total ?? 0);
  const qualityRows = [
    ["전체 raw", num(q.total), ""],
    ["search.update_time 존재", num(q.search_update_time_present), pct(q.search_update_time_present, total)],
    ["searchMeta.updateTime 존재", num(q.search_meta_update_time_present), pct(q.search_meta_update_time_present, total)],
    ["update raw 후보 존재", num(q.any_update_raw_present), pct(q.any_update_raw_present, total)],
    ["timestamp 파싱 가능", num(q.update_ts_parseable), pct(q.update_ts_parseable, total)],
    ["timestamp plausible", num(q.update_ts_plausible), pct(q.update_ts_plausible, total)],
    ["future", num(q.update_ts_future), "제외"],
    ["too old", num(q.update_ts_too_old), "제외"],
    ["first_seen보다 10분 이상 늦음", num(q.update_after_first_seen), "업로드시각으로 부적합"],
    ["first_seen 이전/근접", num(q.update_before_or_near_first_seen), "source_updated 후보"],
    ["min update_ts", q.min_update_ts ?? "-", ""],
    ["max update_ts", q.max_update_ts ?? "-", ""],
  ];

  const deltaRows = [
    ["first_seen - update P10", hours(d.first_minus_update_p10_h)],
    ["first_seen - update P50", hours(d.first_minus_update_p50_h)],
    ["first_seen - update P90", hours(d.first_minus_update_p90_h)],
    ["sold_detected - update P50", hours(d.sold_minus_update_p50_h)],
  ];

  const keyRows = (report.search_key_counts ?? []).map((row) => [row.key, num(row.count)]);
  const exampleRows = (report.examples ?? []).map((row) => [
    row.bucket,
    row.pid,
    compact(row.name),
    row.listing_state,
    row.update_raw ?? "-",
    row.update_ts ?? "-",
    row.first_seen_at ?? "-",
    hours(row.first_minus_update_h),
  ]);

  const decisions = [];
  if (Number(q.update_ts_plausible ?? 0) > 0 && Number(q.update_after_first_seen ?? 0) === 0) {
    decisions.push("- `update_time`은 전량 timestamp로 파싱 가능하고 `first_seen_at`보다 늦지 않아 `source_updated_at` 후보로 쓸 수 있다.");
  } else if (Number(q.update_ts_plausible ?? 0) > 0) {
    decisions.push("- `update_time`은 일부 timestamp로 쓸 수 있지만 `first_seen_at`보다 늦는 샘플이 있어 업로드시각으로 바로 쓰면 안 된다.");
  } else {
    decisions.push("- 현재 raw에서는 바로 쓸 수 있는 source time 후보가 없다.");
  }
  decisions.push("- `update_time`은 이름상 업로드시각이 아니라 수정/갱신시각일 가능성이 높으므로 `source_uploaded_at`이 아니라 `source_updated_at`부터 채우는 것이 안전하다.");

  return [
    "# Source Time Field 진단",
    "",
    `생성: ${report.generated_at ?? new Date().toISOString()}`,
    "",
    "## Coverage / Quality",
    "",
    table(["항목", "값", "비고"], qualityRows),
    "",
    "## Delta",
    "",
    table(["항목", "값"], deltaRows),
    "",
    "## Search Raw Key 샘플",
    "",
    keyRows.length ? table(["key", "count"], keyRows) : "- key sample 없음.",
    "",
    "## 예시",
    "",
    exampleRows.length ? table(["bucket", "pid", "name", "state", "raw", "update_ts", "first_seen", "delta"], exampleRows) : "- 예시 없음.",
    "",
    "## 판단",
    "",
    ...decisions,
    "",
    "## 다음 액션",
    "",
    "1. `update_time`을 `source_updated_at`으로 backfill하는 dry-run/apply 스크립트를 만든다.",
    "2. search upsert에서 신규/기존 row 모두 `source_updated_at`을 보존 업데이트한다.",
    "3. `source_uploaded_at`은 detail API 또는 별도 원천에서 더 강한 생성시각 필드를 찾기 전까지 비워둔다.",
    "",
  ].join("\n");
}

await mkdir(reportsDir, { recursive: true });
const report = await runSql(SQL);
await writeFile(path.join(reportsDir, "source-time-fields-latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
await writeFile(path.join(reportsDir, "source-time-fields-latest.md"), renderMarkdown(report), "utf-8");

console.log("wrote reports/source-time-fields-latest.json");
console.log("wrote reports/source-time-fields-latest.md");
