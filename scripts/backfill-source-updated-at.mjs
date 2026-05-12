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

function flag(name) {
  const raw = arg(name, "");
  return raw === "1" || raw === "true" || raw === "yes" || process.argv.includes(`--${name}`);
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

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(value, max = 58) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const apply = flag("apply");
const sampleLimit = intArg("sampleLimit", 80, 10, 500);
const mode = apply ? "apply" : "dry-run";

const CANDIDATE_CTE = `
candidate_rows as (
  select
    pid,
    name,
    listing_state,
    first_seen_at,
    last_seen_at,
    source_updated_at as old_source_updated_at,
    case
      when update_raw ~ '^\\d+(\\.\\d+)?$' and update_raw::numeric > 1000000000000
        then to_timestamp(update_raw::numeric / 1000.0)
      when update_raw ~ '^\\d+(\\.\\d+)?$' and update_raw::numeric > 1000000000
        then to_timestamp(update_raw::numeric)
      else null
    end as new_source_updated_at,
    update_raw
  from (
    select
      pid,
      name,
      listing_state,
      first_seen_at,
      last_seen_at,
      source_updated_at,
      coalesce(
        raw_json #>> '{search,update_time}',
        raw_json #>> '{searchMeta,updateTime}',
        raw_json #>> '{search,num_update_time}',
        raw_json #>> '{search,updateTime}'
      ) as update_raw
    from public.mvp_raw_listings
  ) src
),
eligible_rows as (
  select *
  from candidate_rows
  where new_source_updated_at is not null
    and new_source_updated_at >= timestamp with time zone '2020-01-01'
    and new_source_updated_at <= now() + interval '1 day'
    and old_source_updated_at is distinct from new_source_updated_at
)
`;

const DRY_RUN_SQL = `
with ${CANDIDATE_CTE}
select json_build_object(
  'mode', 'dry-run',
  'generated_at', now(),
  'summary', json_build_object(
    'eligible_count', (select count(*)::int from eligible_rows),
    'null_to_value_count', (select count(*)::int from eligible_rows where old_source_updated_at is null),
    'value_changed_count', (select count(*)::int from eligible_rows where old_source_updated_at is not null),
    'after_first_seen_count', (select count(*)::int from eligible_rows where new_source_updated_at > first_seen_at + interval '10 minutes'),
    'before_or_near_first_seen_count', (select count(*)::int from eligible_rows where new_source_updated_at <= first_seen_at + interval '10 minutes')
  ),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select
      pid,
      name,
      listing_state,
      first_seen_at,
      last_seen_at,
      old_source_updated_at,
      new_source_updated_at,
      update_raw,
      extract(epoch from (first_seen_at - new_source_updated_at)) / 3600.0 as first_minus_update_h
    from eligible_rows
    order by old_source_updated_at nulls first, pid desc
    limit ${sampleLimit}
  ) t), '[]'::json)
) as report;
`;

const APPLY_SQL = `
with ${CANDIDATE_CTE},
updated as (
  update public.mvp_raw_listings r
  set
    source_updated_at = e.new_source_updated_at,
    updated_at = now()
  from eligible_rows e
  where r.pid = e.pid
  returning
    r.pid,
    r.name,
    r.listing_state,
    e.old_source_updated_at,
    r.source_updated_at as new_source_updated_at,
    e.update_raw,
    r.first_seen_at,
    r.last_seen_at
)
select json_build_object(
  'mode', 'apply',
  'generated_at', now(),
  'summary', json_build_object(
    'updated_count', (select count(*)::int from updated),
    'null_to_value_count', (select count(*)::int from updated where old_source_updated_at is null),
    'value_changed_count', (select count(*)::int from updated where old_source_updated_at is not null),
    'after_first_seen_count', (select count(*)::int from updated where new_source_updated_at > first_seen_at + interval '10 minutes'),
    'before_or_near_first_seen_count', (select count(*)::int from updated where new_source_updated_at <= first_seen_at + interval '10 minutes')
  ),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select
      pid,
      name,
      listing_state,
      first_seen_at,
      last_seen_at,
      old_source_updated_at,
      new_source_updated_at,
      update_raw,
      extract(epoch from (first_seen_at - new_source_updated_at)) / 3600.0 as first_minus_update_h
    from updated
    order by pid desc
    limit ${sampleLimit}
  ) t), '[]'::json)
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
  const summary = report.summary ?? {};
  const count = mode === "apply" ? summary.updated_count : summary.eligible_count;
  const rows = [
    [mode === "apply" ? "updated" : "eligible", num(count)],
    ["null -> value", num(summary.null_to_value_count)],
    ["value changed", num(summary.value_changed_count)],
    ["first_seen보다 10분 이상 늦음", num(summary.after_first_seen_count)],
    ["first_seen 이전/근접", num(summary.before_or_near_first_seen_count)],
  ];

  const examples = (report.examples ?? []).map((row) => [
    row.pid,
    compact(row.name),
    row.listing_state,
    row.old_source_updated_at ?? "-",
    row.new_source_updated_at ?? "-",
    row.update_raw ?? "-",
    hours(row.first_minus_update_h),
  ]);

  return [
    "# Source Updated At Backfill",
    "",
    `mode: ${mode}`,
    `generated: ${report.generated_at ?? new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    table(["항목", "값"], rows),
    "",
    "## Examples",
    "",
    examples.length ? table(["pid", "name", "state", "old", "new", "raw", "first_seen - update"], examples) : "- 대상 없음.",
    "",
    "## 판단",
    "",
    mode === "dry-run"
      ? "- dry-run만 수행했다. 적용하려면 `npm run backfill:source-updated-at -- --apply=1`을 실행한다."
      : "- apply를 수행했다. 이후 `npm run report:sold-velocity-prereqs`로 coverage를 다시 확인한다.",
    "",
  ].join("\n");
}

await mkdir(reportsDir, { recursive: true });
const report = await runSql(apply ? APPLY_SQL : DRY_RUN_SQL);
const stem = `source-updated-at-backfill-${mode}-latest`;
await writeFile(path.join(reportsDir, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
await writeFile(path.join(reportsDir, `${stem}.md`), renderMarkdown(report), "utf-8");

console.log(`wrote reports/${stem}.json`);
console.log(`wrote reports/${stem}.md`);
