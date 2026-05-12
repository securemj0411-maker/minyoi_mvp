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
  const text = stdout.trim();
  return JSON.parse(text);
}

function num(value) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function pct(value, digits = 1) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(digits)}%`;
}

function hours(value) {
  if (value == null) return "-";
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "-";
  if (n < 24) return `${n.toFixed(1)}h`;
  return `${(n / 24).toFixed(1)}d`;
}

function compactName(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 56 ? `${text.slice(0, 56)}...` : text;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

const sampleLimit = intArg("sampleLimit", 60, 10, 300);

const SQL = `
with raw_base as (
  select
    r.pid,
    r.name,
    r.price,
    r.listing_state,
    r.sale_status,
    r.listing_type,
    r.detail_status,
    r.sku_id,
    r.sku_name,
    r.first_seen_at,
    r.last_seen_at,
    r.last_changed_at,
    r.source_uploaded_at,
    r.source_updated_at,
    r.sold_detected_at,
    r.disappeared_at,
    r.detail_enriched_at,
    p.category,
    p.comparable_key,
    p.needs_review,
    p.parse_confidence
  from public.mvp_raw_listings r
  left join public.mvp_listing_parsed p on p.pid = r.pid
),
summary as (
  select
    count(*)::int as total_raw,
    count(*) filter (where listing_state = 'active')::int as active_raw,
    count(*) filter (where listing_state = 'sold_confirmed')::int as sold_confirmed_raw,
    count(*) filter (where listing_state = 'disappeared')::int as disappeared_raw,
    count(*) filter (where listing_state = 'missing_suspect')::int as missing_suspect_raw,
    count(*) filter (where listing_state in ('sold_confirmed','disappeared','archived'))::int as terminal_raw,
    count(*) filter (where detail_status = 'done')::int as detail_done,
    count(*) filter (where listing_type = 'normal')::int as normal_rows,
    count(*) filter (where comparable_key is not null and comparable_key <> '')::int as comparable_key_rows,
    count(*) filter (where source_uploaded_at is not null)::int as source_uploaded_present,
    count(*) filter (where source_updated_at is not null)::int as source_updated_present,
    count(*) filter (where sold_detected_at is not null)::int as sold_detected_present
  from raw_base
),
clock_quality as (
  select
    count(*) filter (where last_seen_at < first_seen_at)::int as last_seen_before_first_seen,
    count(*) filter (where source_uploaded_at is not null and source_uploaded_at > first_seen_at + interval '5 minutes')::int as source_uploaded_after_first_seen,
    count(*) filter (where source_uploaded_at is not null and source_uploaded_at > now() + interval '5 minutes')::int as source_uploaded_in_future,
    count(*) filter (where sold_detected_at is not null and sold_detected_at < first_seen_at)::int as sold_before_first_seen,
    count(*) filter (where source_uploaded_at is not null and sold_detected_at is not null and sold_detected_at < source_uploaded_at)::int as sold_before_source_uploaded,
    count(*) filter (where listing_state = 'sold_confirmed' and sold_detected_at is null)::int as sold_confirmed_without_sold_detected_at,
    count(*) filter (where listing_state = 'active' and sold_detected_at is not null)::int as active_with_sold_detected_at,
    count(*) filter (where listing_state = 'active' and disappeared_at is not null)::int as active_with_disappeared_at
  from raw_base
),
velocity_rows as (
  select
    *,
    extract(epoch from (sold_detected_at - first_seen_at)) / 3600.0 as hours_from_first_seen,
    case
      when source_uploaded_at is not null
      then extract(epoch from (sold_detected_at - source_uploaded_at)) / 3600.0
      else null
    end as hours_from_source_upload
  from raw_base
  where listing_state = 'sold_confirmed'
    and sold_detected_at is not null
    and sold_detected_at >= first_seen_at
),
velocity_summary as (
  select
    count(*)::int as sample_count,
    count(*) filter (where source_uploaded_at is not null and sold_detected_at >= source_uploaded_at)::int as source_upload_sample_count,
    percentile_cont(0.25) within group (order by hours_from_first_seen) as first_seen_p25_h,
    percentile_cont(0.50) within group (order by hours_from_first_seen) as first_seen_p50_h,
    percentile_cont(0.75) within group (order by hours_from_first_seen) as first_seen_p75_h,
    percentile_cont(0.50) within group (order by hours_from_source_upload) filter (where source_uploaded_at is not null and sold_detected_at >= source_uploaded_at) as source_upload_p50_h
  from velocity_rows
),
market_velocity_table as (
  select
    count(*)::int as rows,
    count(*) filter (where confidence in ('high', 'medium'))::int as public_usable_rows,
    count(*) filter (where confidence = 'high')::int as high_rows,
    count(*) filter (where confidence = 'medium')::int as medium_rows,
    count(*) filter (where confidence = 'low')::int as low_rows,
    coalesce(sum(observed_sold_sample_count), 0)::int as observed_sold_sample_count,
    coalesce(sum(active_sample_count), 0)::int as active_sample_count,
    max(date) as latest_date,
    max(computed_at) as latest_computed_at
  from public.mvp_market_velocity_daily
),
by_category as (
  select
    coalesce(category, 'unknown') as category,
    count(*)::int as rows,
    count(*) filter (where listing_state = 'active')::int as active,
    count(*) filter (where listing_state = 'sold_confirmed')::int as sold_confirmed,
    count(*) filter (where listing_state = 'sold_confirmed' and sold_detected_at is not null)::int as sold_with_clock,
    count(*) filter (where listing_state = 'sold_confirmed' and source_uploaded_at is not null and sold_detected_at is not null)::int as sold_with_upload_clock,
    count(distinct comparable_key) filter (where comparable_key is not null and comparable_key <> '')::int as comparable_keys
  from raw_base
  group by coalesce(category, 'unknown')
),
by_comparable_key as (
  select
    coalesce(category, 'unknown') as category,
    comparable_key,
    count(*)::int as rows,
    count(*) filter (where listing_state = 'active')::int as active,
    count(*) filter (where listing_state = 'sold_confirmed')::int as sold_confirmed,
    count(*) filter (where listing_state = 'sold_confirmed' and sold_detected_at is not null)::int as sold_with_clock,
    percentile_cont(0.50) within group (order by extract(epoch from (sold_detected_at - first_seen_at)) / 3600.0)
      filter (where listing_state = 'sold_confirmed' and sold_detected_at is not null and sold_detected_at >= first_seen_at) as median_hours_from_first_seen
  from raw_base
  where comparable_key is not null and comparable_key <> ''
  group by coalesce(category, 'unknown'), comparable_key
),
observation_summary as (
  select
    event_type,
    count(*)::int as total,
    count(*) filter (where observed_at >= now() - interval '24 hours')::int as last_24h,
    count(*) filter (where observed_at >= now() - interval '7 days')::int as last_7d,
    count(distinct pid)::int as distinct_pids,
    max(observed_at) as latest_observed_at
  from public.mvp_listing_observations
  group by event_type
),
lifecycle_summary as (
  select
    status,
    priority_tier,
    count(*)::int as rows,
    count(*) filter (where next_check_at <= now())::int as due_now,
    count(*) filter (where locked_until is not null and locked_until > now())::int as locked_now,
    count(*) filter (where last_checked_at is not null)::int as checked_once,
    max(last_checked_at) as latest_checked_at
  from public.mvp_lifecycle_checks
  group by status, priority_tier
),
bad_clock_examples as (
  select
    pid,
    name,
    listing_state,
    category,
    comparable_key,
    first_seen_at,
    last_seen_at,
    source_uploaded_at,
    sold_detected_at,
    case
      when last_seen_at < first_seen_at then 'last_seen_before_first_seen'
      when source_uploaded_at is not null and source_uploaded_at > first_seen_at + interval '5 minutes' then 'source_uploaded_after_first_seen'
      when sold_detected_at is not null and sold_detected_at < first_seen_at then 'sold_before_first_seen'
      when source_uploaded_at is not null and sold_detected_at is not null and sold_detected_at < source_uploaded_at then 'sold_before_source_uploaded'
      when listing_state = 'sold_confirmed' and sold_detected_at is null then 'sold_confirmed_without_sold_detected_at'
      when listing_state = 'active' and sold_detected_at is not null then 'active_with_sold_detected_at'
      else 'other'
    end as issue
  from raw_base
  where last_seen_at < first_seen_at
     or (source_uploaded_at is not null and source_uploaded_at > first_seen_at + interval '5 minutes')
     or (sold_detected_at is not null and sold_detected_at < first_seen_at)
     or (source_uploaded_at is not null and sold_detected_at is not null and sold_detected_at < source_uploaded_at)
     or (listing_state = 'sold_confirmed' and sold_detected_at is null)
     or (listing_state = 'active' and sold_detected_at is not null)
  order by sold_detected_at desc nulls last, last_seen_at desc
  limit ${sampleLimit}
)
select json_build_object(
  'generated_at', now(),
  'summary', (select row_to_json(summary) from summary),
  'clock_quality', (select row_to_json(clock_quality) from clock_quality),
  'velocity_summary', (select row_to_json(velocity_summary) from velocity_summary),
  'market_velocity_table', (select row_to_json(market_velocity_table) from market_velocity_table),
  'by_category', coalesce((select json_agg(row_to_json(t)) from (
    select * from by_category order by rows desc, category
  ) t), '[]'::json),
  'top_velocity_keys', coalesce((select json_agg(row_to_json(t)) from (
    select *
    from by_comparable_key
    where sold_with_clock >= 3
    order by sold_with_clock desc, rows desc
    limit 30
  ) t), '[]'::json),
  'observation_summary', coalesce((select json_agg(row_to_json(t)) from (
    select * from observation_summary order by total desc, event_type
  ) t), '[]'::json),
  'lifecycle_summary', coalesce((select json_agg(row_to_json(t)) from (
    select * from lifecycle_summary order by status, priority_tier
  ) t), '[]'::json),
  'bad_clock_examples', coalesce((select json_agg(row_to_json(t)) from bad_clock_examples t), '[]'::json)
) as report;
`;

function renderMarkdown(report) {
  const s = report.summary ?? {};
  const q = report.clock_quality ?? {};
  const v = report.velocity_summary ?? {};
  const m = report.market_velocity_table ?? {};
  const total = Number(s.total_raw ?? 0) || 1;
  const sold = Number(s.sold_confirmed_raw ?? 0) || 1;
  const generatedAt = report.generated_at ?? new Date().toISOString();

  const clockRows = [
    ["source_uploaded_at 존재", num(s.source_uploaded_present), pct(Number(s.source_uploaded_present ?? 0) / total)],
    ["source_updated_at 존재", num(s.source_updated_present), pct(Number(s.source_updated_present ?? 0) / total)],
    ["sold_detected_at 존재", num(s.sold_detected_present), pct(Number(s.sold_detected_present ?? 0) / total)],
    ["sold_confirmed 중 sold_detected_at 없음", num(q.sold_confirmed_without_sold_detected_at), pct(Number(q.sold_confirmed_without_sold_detected_at ?? 0) / sold)],
    ["last_seen < first_seen", num(q.last_seen_before_first_seen), "무결성 오류"],
    ["source_uploaded > first_seen", num(q.source_uploaded_after_first_seen), "업로드시각 파싱 의심"],
    ["sold < first_seen", num(q.sold_before_first_seen), "속도 계산 제외"],
    ["sold < source_uploaded", num(q.sold_before_source_uploaded), "속도 계산 제외"],
    ["active인데 sold_detected_at 있음", num(q.active_with_sold_detected_at), "과거 sold signal/재노출 모델링 필요"],
  ];

  const velocityRows = [
    ["속도 계산 가능 sold 표본", num(v.sample_count), "first_seen -> sold_detected"],
    ["source upload 기준 표본", num(v.source_upload_sample_count), "source_uploaded -> sold_detected"],
    ["P25", hours(v.first_seen_p25_h), "first_seen 기준"],
    ["P50", hours(v.first_seen_p50_h), "first_seen 기준"],
    ["P75", hours(v.first_seen_p75_h), "first_seen 기준"],
    ["P50", hours(v.source_upload_p50_h), "source_uploaded 기준"],
  ];

  const materializedRows = [
    ["mvp_market_velocity_daily rows", num(m.rows), `latest date ${m.latest_date ?? "-"}`],
    ["public usable confidence", num(m.public_usable_rows), "high/medium only"],
    ["high", num(m.high_rows), "표본 20건+"],
    ["medium", num(m.medium_rows), "표본 8건+"],
    ["low", num(m.low_rows), "UI 참고/비공개"],
    ["materialized sold samples", num(m.observed_sold_sample_count), "sold_confirmed + sold_detected_at 기준"],
    ["materialized active samples", num(m.active_sample_count), "current active pool/market denominator"],
    ["latest computed", m.latest_computed_at ?? "-", "sync timestamp"],
  ];

  const categoryRows = (report.by_category ?? []).map((row) => [
    row.category,
    num(row.rows),
    num(row.active),
    num(row.sold_confirmed),
    num(row.sold_with_clock),
    num(row.sold_with_upload_clock),
    num(row.comparable_keys),
  ]);

  const keyRows = (report.top_velocity_keys ?? []).map((row) => [
    row.category,
    row.comparable_key,
    num(row.rows),
    num(row.sold_confirmed),
    num(row.sold_with_clock),
    hours(row.median_hours_from_first_seen),
  ]);

  const observationRows = (report.observation_summary ?? []).map((row) => [
    row.event_type,
    num(row.total),
    num(row.last_24h),
    num(row.last_7d),
    num(row.distinct_pids),
    row.latest_observed_at ?? "-",
  ]);

  const lifecycleRows = (report.lifecycle_summary ?? []).map((row) => [
    row.status,
    row.priority_tier,
    num(row.rows),
    num(row.due_now),
    num(row.locked_now),
    num(row.checked_once),
    row.latest_checked_at ?? "-",
  ]);

  const badRows = (report.bad_clock_examples ?? []).map((row) => [
    row.issue,
    row.pid,
    compactName(row.name),
    row.listing_state,
    row.category ?? "-",
    row.first_seen_at ?? "-",
    row.source_uploaded_at ?? "-",
    row.sold_detected_at ?? "-",
  ]);

  const interpretation = [];
  if (Number(q.sold_confirmed_without_sold_detected_at ?? 0) > 0) {
    interpretation.push("- `sold_confirmed`인데 `sold_detected_at`이 없는 row가 있어 속도 계산 전 보정이 필요하다.");
  }
  if (Number(q.source_uploaded_after_first_seen ?? 0) > 0) {
    interpretation.push("- `source_uploaded_at`이 `first_seen_at`보다 늦은 row는 번개장터 업로드 시각 파싱/타임존을 재검토해야 한다.");
  }
  if (Number(v.sample_count ?? 0) < 30) {
    interpretation.push("- sold velocity 표본이 아직 작다. UI에는 SKU별 확정 속도보다 `표본 부족` 상태를 먼저 보여줘야 한다.");
  }
  if (Number(s.source_uploaded_present ?? 0) / total < 0.5) {
    interpretation.push("- `source_uploaded_at` 커버리지가 낮아 실제 업로드 기준 판매속도보다 `first_seen_at` 기준 관측속도가 우선이다.");
  }
  if (Number(s.source_updated_present ?? 0) > 0) {
    interpretation.push("- `source_updated_at`은 판매자가 글을 수정/재노출한 신호로 쓰고, 업로드 기준 판매속도 계산에는 사용하지 않는다.");
  }
  if (Number(q.active_with_sold_detected_at ?? 0) > 0) {
    interpretation.push("- `active`인데 `sold_detected_at`이 남아 있는 row가 많다. 이는 상태 불일치라기보다 재노출/복구 이력일 수 있으므로, 속도 모델은 현재 상태와 terminal interval을 분리해야 한다.");
  }
  if (Number(m.rows ?? 0) > 0) {
    interpretation.push("- `mvp_market_velocity_daily`는 이미 생성/갱신되어 있다. 현재 materialization은 `listing_state = sold_confirmed`인 row만 판매속도 표본으로 쓰므로, `active_with_sold_detected_at`이 곧바로 공개 velocity를 오염시키지는 않는다.");
  }
  if (interpretation.length === 0) {
    interpretation.push("- 치명적인 clock 무결성 오류는 낮다. 다음 단계는 SKU별 sold velocity materialization 설계다.");
  }

  return [
    "# Sold Velocity 전제 조건 진단",
    "",
    `생성: ${generatedAt}`,
    "",
    "## 요약",
    "",
    table(["항목", "값"], [
      ["전체 raw listings", num(s.total_raw)],
      ["active", num(s.active_raw)],
      ["sold_confirmed", num(s.sold_confirmed_raw)],
      ["disappeared", num(s.disappeared_raw)],
      ["missing_suspect", num(s.missing_suspect_raw)],
      ["detail_done", num(s.detail_done)],
      ["normal rows", num(s.normal_rows)],
      ["comparable key rows", num(s.comparable_key_rows)],
    ]),
    "",
    "## Clock Coverage / Integrity",
    "",
    table(["검사", "건수", "해석"], clockRows),
    "",
    "## Velocity 표본",
    "",
    table(["항목", "값", "기준"], velocityRows),
    "",
    "## Materialized Velocity Table",
    "",
    table(["항목", "값", "해석"], materializedRows),
    "",
    "## 카테고리별 상태",
    "",
    table(["category", "rows", "active", "sold", "sold clock", "upload clock", "keys"], categoryRows),
    "",
    "## SKU별 판매속도 표본 상위",
    "",
    keyRows.length ? table(["category", "comparable_key", "rows", "sold", "sold clock", "median"], keyRows) : "- SKU별 표본 3건 이상인 key가 아직 없습니다.",
    "",
    "## Observation 이벤트",
    "",
    table(["event_type", "total", "24h", "7d", "pids", "latest"], observationRows),
    "",
    "## Lifecycle Queue",
    "",
    table(["status", "tier", "rows", "due", "locked", "checked", "latest"], lifecycleRows),
    "",
    "## Clock 문제 예시",
    "",
    badRows.length ? table(["issue", "pid", "name", "state", "category", "first_seen", "source_upload", "sold"], badRows) : "- 문제 예시 없음.",
    "",
    "## 판단",
    "",
    ...interpretation,
    "",
    "## 다음 액션",
    "",
    "1. `source_uploaded_at` 커버리지가 낮으므로 UI에는 업로드 기준 판매속도 대신 관측 기준 판매속도라고 표시한다.",
    "2. search API의 `updateTime`은 `source_updated_at`으로만 사용하고, detail API 원본에서 별도 업로드 시각 후보를 계속 찾는다.",
    "3. `active_with_sold_detected_at`은 단순 오류로 지우지 말고, 재노출/복구 이력과 terminal interval 모델로 분리한다.",
    "4. SKU별 속도는 `sold_with_clock >= 8` 이상부터 medium confidence로 두고, 그 전에는 참고값으로만 쓴다.",
    "5. `mvp_market_velocity_daily`는 이미 적용되어 있으므로 다음 구현은 새 DDL이 아니라 terminal interval 후보 리포트/설계로 간다.",
    "",
  ].join("\n");
}

await mkdir(reportsDir, { recursive: true });
const report = await runSql(SQL);
await writeFile(path.join(reportsDir, "sold-velocity-prereqs-latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
await writeFile(path.join(reportsDir, "sold-velocity-prereqs-latest.md"), renderMarkdown(report), "utf-8");

console.log("wrote reports/sold-velocity-prereqs-latest.json");
console.log("wrote reports/sold-velocity-prereqs-latest.md");
